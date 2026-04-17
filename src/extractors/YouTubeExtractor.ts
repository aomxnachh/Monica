/**
 * YouTubeExtractor — discord-player v7 custom extractor
 *
 * Requires YOUTUBE_COOKIE in .env (see .env.example for how to get it).
 *
 * Strategy:
 *   Search/Info : play-dl         — fast, no auth needed
 *   Stream      : yt-dlp (binary) — reliable, bypasses po_token
 */

import {
  BaseExtractor,
  Playlist,
  QueryType,
  Track,
  type ExtractorInfo,
  type ExtractorSearchContext,
  type ExtractorStreamable,
  type GuildQueueHistory,
  type SearchQueryType,
} from 'discord-player';
import { execFile, execFileSync, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import playdl from 'play-dl';

// ─── yt-dlp binary path ───────────────────────────────────────────────────────
const __dirname = fileURLToPath(new URL('.', import.meta.url));

function resolveYtdlp(): string {
  if (process.platform === 'win32') {
    return join(__dirname, '../../node_modules/youtube-dl-exec/bin/yt-dlp.exe');
  }
  // On Linux: try PATH first, then common Nix/system locations
  try { return execSync('which yt-dlp', { encoding: 'utf8' }).trim(); } catch { /* not in PATH */ }
  for (const p of ['/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/nix/var/nix/profiles/default/bin/yt-dlp']) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch { /* skip */ }
  }
  return 'yt-dlp'; // last resort
}

const YTDLP_BIN = resolveYtdlp();
console.log('[YouTubeExtractor] yt-dlp binary:', YTDLP_BIN);

// ─── Cookie bootstrap (call once before any stream requests) ─────────────────
let _cookieFile: string | null = null;

export async function bootstrapYouTubeCookies(): Promise<void> {
  const cookie = process.env.YOUTUBE_COOKIE;
  if (!cookie) {
    console.warn(
      '[YouTubeExtractor] ⚠  YOUTUBE_COOKIE is not set.\n' +
      '  YouTube requires cookies to stream audio.\n' +
      '  See .env.example for instructions on how to obtain them.',
    );
    return;
  }

  try {
    // Write Netscape-format cookie file for yt-dlp
    _cookieFile = join(tmpdir(), 'monica-yt-cookies.txt');
    writeFileSync(_cookieFile, cookieHeaderToNetscape(cookie));

    // Also set play-dl cookies for search/metadata
    await playdl.setToken({ youtube: { cookie } });

    console.log('[YouTubeExtractor] ✅ YouTube cookies loaded successfully.');
  } catch (e) {
    console.error('[YouTubeExtractor] ❌ Failed to load cookies:', (e as Error).message);
  }
}

function cookieHeaderToNetscape(cookieStr: string): string {
  const pairs = cookieStr.split(';').map(s => s.trim()).filter(Boolean);
  let lines = '# Netscape HTTP Cookie File\n';
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const name  = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    lines += `.youtube.com\tTRUE\t/\tTRUE\t9999999999\t${name}\t${value}\n`;
  }
  return lines;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const YT_URL  = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/)/i;
const YT_LIST = /[?&]list=[A-Za-z0-9_-]+/;

function extractVideoId(url: string): string | null {
  return url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null;
}

function secToMMSS(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function bestThumb(thumbs?: { url: string }[]): string {
  return thumbs?.at(-1)?.url ?? thumbs?.[0]?.url ?? '';
}

// ─── Extractor ────────────────────────────────────────────────────────────────

export class YouTubeExtractor extends BaseExtractor {
  static identifier = 'com.monica.youtube-extractor' as const;

  override async activate(): Promise<void> {
    this.protocols = ['ytsearch', 'youtube'];
    await bootstrapYouTubeCookies();

    try {
      const ver = execFileSync(YTDLP_BIN, ['--version'], { encoding: 'utf8' }).trim();
      console.log(`[YouTubeExtractor] ✅ yt-dlp version: ${ver}`);
    } catch (e) {
      console.warn(`[YouTubeExtractor] ⚠  yt-dlp not working: ${(e as Error).message}`);
    }
  }

  override async validate(
    query: string,
    type?: SearchQueryType | null,
  ): Promise<boolean> {
    if (
      type === QueryType.YOUTUBE        ||
      type === QueryType.YOUTUBE_VIDEO  ||
      type === QueryType.YOUTUBE_SEARCH ||
      type === QueryType.YOUTUBE_PLAYLIST ||
      type === QueryType.AUTO           ||
      type === QueryType.AUTO_SEARCH
    ) return true;
    return YT_URL.test(query) || (YT_LIST.test(query) && query.includes('youtube'));
  }

  override async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    if (
      context.type === QueryType.YOUTUBE_PLAYLIST ||
      (YT_LIST.test(query) && query.includes('youtube'))
    ) return this._handlePlaylist(query, context);

    if (YT_URL.test(query)) return this._handleVideoURL(query, context);

    return this._handleSearch(query, context);
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  private async _handleSearch(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const results = await playdl.search(query, {
      source: { youtube: 'video' },
      limit: 10,
    }).catch(() => []);

    const tracks = results.map(v =>
      new Track(this.context.player, {
        title:       v.title        ?? 'Unknown',
        description: '',
        author:      v.channel?.name ?? 'Unknown',
        url:         v.url,
        thumbnail:   bestThumb(v.thumbnails),
        duration:    v.durationRaw  ?? '0:00',
        views:       v.views        ?? 0,
        source:      'youtube',
        requestedBy: context.requestedBy ?? null,
        queryType:   QueryType.YOUTUBE,
        live:        v.live,
        raw:         v,
      }),
    );
    return this.createResponse(null, tracks);
  }

  // ── Single URL ─────────────────────────────────────────────────────────────

  private async _handleVideoURL(url: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const info = await playdl.video_info(url).catch(() => null);
    if (!info) return this.createResponse(null, []);

    const d = info.video_details;
    const track = new Track(this.context.player, {
      title:       d.title        ?? 'Unknown',
      description: d.description  ?? '',
      author:      d.channel?.name ?? 'Unknown',
      url:         d.url,
      thumbnail:   bestThumb(d.thumbnails),
      duration:    d.durationRaw  ?? secToMMSS(d.durationInSec ?? 0),
      views:       d.views        ?? 0,
      source:      'youtube',
      requestedBy: context.requestedBy ?? null,
      queryType:   QueryType.YOUTUBE_VIDEO,
      live:        d.live,
      raw:         d,
    });
    return this.createResponse(null, [track]);
  }

  // ── Playlist ───────────────────────────────────────────────────────────────

  private async _handlePlaylist(url: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
    const list = await playdl.playlist_info(url, { incomplete: true }).catch(() => null);
    if (!list) return this.createResponse(null, []);

    const playlist = new Playlist(this.context.player, {
      title:       list.title ?? 'YouTube Playlist',
      description: '',
      thumbnail:   '',
      type:        'playlist',
      source:      'youtube',
      author:      { name: 'YouTube', url: '' },
      tracks:      [],
      id:          list.id  ?? '',
      url:         list.url ?? url,
      rawPlaylist: list,
    });

    const videos = await list.all_videos().catch(() => []);
    const tracks = (videos as Awaited<ReturnType<typeof list.all_videos>>).map(v =>
      new Track(this.context.player, {
        title:       v.title         ?? 'Unknown',
        description: '',
        author:      v.channel?.name ?? 'Unknown',
        url:         v.url,
        thumbnail:   bestThumb(v.thumbnails),
        duration:    v.durationRaw   ?? secToMMSS(v.durationInSec ?? 0),
        views:       v.views         ?? 0,
        source:      'youtube',
        requestedBy: context.requestedBy ?? null,
        queryType:   QueryType.YOUTUBE,
        playlist,
        raw:         v,
      }),
    );
    playlist.tracks = tracks;
    return this.createResponse(playlist, tracks);
  }

  // ── Stream via yt-dlp ─────────────────────────────────────────────────────

  override async stream(track: Track): Promise<ExtractorStreamable> {
    const videoId = extractVideoId(track.url);
    const ytUrl   = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : track.url;

    const args: string[] = [
      ytUrl,
      '--format', 'bestaudio[ext=webm]/bestaudio/best',
      '--get-url',       // print direct audio URL instead of downloading
      '--no-warnings',
      '--no-playlist',
    ];
    if (_cookieFile) args.push('--cookies', _cookieFile);

    const audioUrl = await new Promise<string>((resolve, reject) => {
      execFile(YTDLP_BIN, args, { timeout: 30_000 }, (error, stdout, stderr) => {
        if (error) {
          const msg = (stderr.trim() || error.message).split('\n')[0];
          console.error('[yt-dlp] error:', msg);
          reject(new Error(`yt-dlp failed: ${msg}`));
        } else {
          const url = stdout.trim().split('\n')[0].trim();
          if (!url) reject(new Error('yt-dlp returned empty URL'));
          else resolve(url);
        }
      });
    });

    console.log(`[yt-dlp] got URL for "${track.title}" (${audioUrl.slice(0, 60)}...)`);
    return audioUrl;
  }

  // ── Related (autoplay) ────────────────────────────────────────────────────

  override async getRelatedTracks(track: Track, _history: GuildQueueHistory): Promise<ExtractorInfo> {
    const results = await playdl.search(
      `${track.title} ${track.author}`,
      { source: { youtube: 'video' }, limit: 6 },
    ).catch(() => []);

    const tracks = results.slice(1).map(v =>
      new Track(this.context.player, {
        title:       v.title        ?? 'Unknown',
        description: '',
        author:      v.channel?.name ?? 'Unknown',
        url:         v.url,
        thumbnail:   bestThumb(v.thumbnails),
        duration:    v.durationRaw  ?? '0:00',
        views:       v.views        ?? 0,
        source:      'youtube',
        requestedBy: null,
        queryType:   QueryType.YOUTUBE,
        live:        v.live,
        raw:         v,
      }),
    );
    return this.createResponse(null, tracks);
  }
}

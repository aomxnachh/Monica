import { Player, type GuildQueue, type Track } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import type { Client } from 'discordx';
import { nowPlayingMessages, type QueueMetadata } from './GuildState.js';
import { buildNowPlayingEmbed, buildMusicComponents } from './MusicEmbed.js';
import { YouTubeExtractor } from '../extractors/YouTubeExtractor.js';

export function setupPlayer(client: Client): void {
  const player = new Player(client as never, {
    skipFFmpeg: false,
  });

  // Load YouTube extractor first (highest priority), then the rest
  Promise.all([
    player.extractors.register(YouTubeExtractor, {}),
    player.extractors.loadMulti(DefaultExtractors),
  ]).then(() => {
    console.log('[Player] All extractors loaded (YouTube + SoundCloud + Spotify + Apple Music).');
  }).catch(console.error);

  // Track starts playing
  player.events.on('playerStart', async (queue: GuildQueue, track: Track) => {
    const meta = queue.metadata as QueueMetadata | null;
    if (!meta?.channel) return;

    const embed      = buildNowPlayingEmbed(queue, track);
    const components = buildMusicComponents(queue);
    const guildId    = queue.guild.id;
    const existing   = nowPlayingMessages.get(guildId);

    try {
      if (existing?.editable) {
        await existing.edit({ embeds: [embed], components });
      } else {
        const msg = await meta.channel.send({ embeds: [embed], components });
        nowPlayingMessages.set(guildId, msg);
      }
    } catch {
      // Fallback: send a new message if editing failed
      try {
        const msg = await meta.channel.send({ embeds: [embed], components });
        nowPlayingMessages.set(guildId, msg);
      } catch (err) {
        console.error('[Player] Could not send now-playing embed:', err);
      }
    }
  });

  // Queue is empty
  player.events.on('emptyQueue', async (queue: GuildQueue) => {
    const guildId = queue.guild.id;
    await nowPlayingMessages.get(guildId)?.delete().catch(() => null);
    nowPlayingMessages.delete(guildId);
  });

  // Bot disconnected from voice
  player.events.on('disconnect', (queue: GuildQueue) => {
    nowPlayingMessages.delete(queue.guild.id);
  });

  // Voice channel becomes empty
  player.events.on('emptyChannel', () => { /* silent leave */ });

  // Errors
  player.events.on('error', (_queue: GuildQueue, error: Error) => {
    console.error('[Player Error]', error.message);
  });

  player.events.on('playerError', (_queue: GuildQueue, error: Error, track: Track) => {
    console.error(`[Track Error] "${track.title}":`, error.message);
  });

  console.log('[Player] discord-player initialized.');
}

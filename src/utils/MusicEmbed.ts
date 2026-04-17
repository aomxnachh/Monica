import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { QueueRepeatMode, type GuildQueue, type Track } from 'discord-player';
import type { QueueMetadata } from './GuildState.js';

// Helpers

function getRepeatModeText(mode: QueueRepeatMode): string {
  switch (mode) {
    case QueueRepeatMode.TRACK:     return 'Track 🔂';
    case QueueRepeatMode.QUEUE:     return 'Queue 🔁';
    case QueueRepeatMode.AUTOPLAY:  return 'Autoplay ✨';
    default:                        return 'Off';
  }
}

function buildProgressBar(progress: number): string {
  const total = 16;
  const filled = Math.round((progress / 100) * total);
  return '▰'.repeat(filled) + '▱'.repeat(total - filled);
}

// Embed Builder

export function buildNowPlayingEmbed(
  queue: GuildQueue,
  track: Track,
): EmbedBuilder {
  const meta    = queue.metadata as QueueMetadata | null;
  const volume  = meta?.volume ?? 80;
  const timestamp = queue.node.getTimestamp();
  const progress  = timestamp?.progress ?? 0;
  const curTime   = timestamp?.current.label ?? '0:00';
  const totTime   = timestamp?.total.label   ?? track.duration;

  const loopMode  = getRepeatModeText(queue.repeatMode);
  const queueSize = queue.tracks.size;
  const isPaused  = queue.node.isPaused();

  const botAvatar = queue.guild.members.me?.user.displayAvatarURL() ?? undefined;

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${isPaused ? '⏸ Paused' : '▶ Now Playing'} • ${queue.channel?.name ?? 'Voice'}`,
      iconURL: botAvatar,
    })
    .setTitle(track.title.length > 100 ? `${track.title.slice(0, 97)}…` : track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .setDescription(
      `by **${track.author}**\n\n` +
      `\`${buildProgressBar(progress)}\`\n` +
      `\`${curTime}\` / \`${totTime}\``,
    )
    .addFields(
      { name: '👤 Requested by', value: `<@${meta?.requestedBy.id ?? 'Unknown'}>`, inline: true },
      { name: '🔊 Volume',       value: `${volume}%`,                                inline: true },
      { name: '📋 Queue',        value: `${queueSize} track${queueSize !== 1 ? 's' : ''} remaining`, inline: true },
      { name: '🔁 Loop',         value: loopMode,                                    inline: true },
      { name: '🎵 Source',       value: track.source.charAt(0).toUpperCase() + track.source.slice(1), inline: true },
      { name: '⏱ Duration',     value: track.duration,                              inline: true },
    )
    .setFooter({ text: 'Monica Music Bot', iconURL: botAvatar })
    .setTimestamp();
}

// Component Builder

export type MusicComponentRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

export function buildMusicComponents(queue: GuildQueue): MusicComponentRow[] {
  const isPaused = queue.node.isPaused();
  const loopMode = queue.repeatMode;
  const loopText = getRepeatModeText(loopMode);

  // Row 1: Main playback controls
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setEmoji('⏹')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_prev')
      .setEmoji('⏮')
      .setLabel('Prev')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setEmoji(isPaused ? '▶' : '⏸')
      .setLabel(isPaused ? 'Resume' : 'Pause')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_next')
      .setEmoji('⏭')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setEmoji('🔀')
      .setLabel('Shuffle')
      .setStyle(ButtonStyle.Secondary),
  );

  // Row 2: Loop / autoplay / volume
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel(`🔁 Loop: ${loopText}`)
      .setStyle(loopMode !== QueueRepeatMode.OFF ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_vol_down')
      .setEmoji('🔉')
      .setLabel('Vol -')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_vol_up')
      .setEmoji('🔊')
      .setLabel('Vol +')
      .setStyle(ButtonStyle.Secondary),
  );

  const rows: MusicComponentRow[] = [row1, row2];

  // Row 3: Queue selector (up to 25 items)
  const tracks = queue.tracks.toArray();
  if (tracks.length > 0) {
    const options = tracks.slice(0, 25).map((t, i) => ({
      label: `${i + 1}. ${t.title}`.slice(0, 100),
      description: `${t.author} • ${t.duration}`.slice(0, 100),
      value: `qi_${i}`,
    }));

    const row3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('music_queue_select')
        .setPlaceholder('🎵 Jump to a song in queue…')
        .addOptions(options),
    );
    rows.push(row3);
  }

  // Row 4: Audio filter selector
  const row4 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('music_filter_select')
      .setPlaceholder('🎚️ Select audio filter…')
      .addOptions([
        { label: '🚫 No Filter',         value: 'none',           description: 'Remove all active filters' },
        { label: '🔊 Bass Boost',         value: 'bassboost_high', description: 'Heavy bass enhancement' },
        { label: '🎵 Bass Boost (Med)',   value: 'bassboost',      description: 'Medium bass enhancement' },
        { label: '🌌 8D Audio',           value: '8D',             description: 'Spatial 360° audio effect' },
        { label: '🌙 Nightcore',          value: 'nightcore',      description: 'Faster + higher pitch' },
        { label: '🌊 Vaporwave',          value: 'vaporwave',      description: 'Slower + lower pitch' },
        { label: '🎤 Karaoke',            value: 'karaoke',        description: 'Reduce vocal frequencies' },
        { label: '📻 Lo-Fi',             value: 'lofi',           description: 'Low-fidelity chill effect' },
        { label: '🔄 Reverse',            value: 'reverse',        description: 'Play audio in reverse' },
      ]),
  );
  rows.push(row4);

  return rows;
}

// "Queue finished" embed

export function buildQueueEndEmbed(guildName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('📭 Queue Finished')
    .setDescription('No more tracks in queue. Add more with `/play`!')
    .setFooter({ text: `Monica Music Bot • ${guildName}` })
    .setTimestamp();
}

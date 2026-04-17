import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  type GuildMember,
  MessageFlags,
  type TextChannel,
  type VoiceBasedChannel,
} from 'discord.js';
import {
  Discord,
  Slash,
  SlashChoice,
  SlashGroup,
  SlashOption,
} from 'discordx';
import type { Client } from 'discordx';
import { QueueRepeatMode, useMainPlayer, useQueue } from 'discord-player';
import { buildNowPlayingEmbed, buildMusicComponents } from '../../utils/MusicEmbed.js';
import { nowPlayingMessages, lastAddedMessages, type QueueMetadata } from '../../utils/GuildState.js';

// Helpers

function getVoiceChannel(interaction: CommandInteraction): VoiceBasedChannel | null {
  return (interaction.member as GuildMember).voice.channel;
}

function assertInVoice(interaction: CommandInteraction): VoiceBasedChannel | undefined {
  const vc = getVoiceChannel(interaction);
  if (!vc) {
    interaction.editReply({ content: '❌ You must be in a voice channel first!' });
    return undefined;
  }
  return vc;
}

function assertQueue(interaction: CommandInteraction) {
  const queue = useQueue(interaction.guildId!);
  if (!queue?.isPlaying()) {
    interaction.editReply({ content: '❌ Nothing is playing right now!' });
    return null;
  }
  return queue;
}

// Music Commands 

@Discord()
@SlashGroup({ name: 'music', description: 'Music playback commands' })
@SlashGroup('music')
export class MusicCommands {

  // /music play

  @Slash({ description: 'Play a song or playlist', name: 'play' })
  async play(
    @SlashOption({
      description: 'Song name, YouTube/Spotify/SoundCloud URL, or playlist link',
      name: 'query',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    query: string,
    interaction: CommandInteraction,
    _client: Client,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId!;
    await lastAddedMessages.get(guildId)?.delete().catch(() => null);
    lastAddedMessages.delete(guildId);

    const voiceChannel = assertInVoice(interaction);
    if (!voiceChannel) return;

    const player = useMainPlayer();

    try {
      const { track } = await player.play(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        voiceChannel as never,
        query,
        {
          nodeOptions: {
            metadata: {
              channel:      interaction.channel as TextChannel,
              requestedBy:  interaction.user,
              volume:       80,
            } satisfies QueueMetadata,
            volume:                 80,
            leaveOnEmpty:           true,
            leaveOnEmptyCooldown:   30_000,
            leaveOnEnd:             false,
            leaveOnEndCooldown:     10_000,
            selfDeaf:               true,
          },
        },
      );

      const isPlaylist = track.playlist != null;

      await interaction.deleteReply().catch(() => null);
      const msg = await (interaction.channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(
              isPlaylist
                ? `✅ Added playlist **${track.playlist!.title}** to the queue!`
                : `✅ Added **[${track.title}](${track.url})** to the queue!`,
            ),
        ],
      });
      lastAddedMessages.set(guildId, msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await interaction.editReply({ content: `❌ ${errMsg}` });
    }
  }

  // /music stop

  @Slash({ description: 'Stop playback and clear the queue', name: 'stop' })
  async stop(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = useQueue(interaction.guildId!);
    if (!queue) {
      await interaction.editReply({ content: '❌ Nothing is playing right now!' });
      return;
    }

    const guildId = interaction.guildId!;
    await Promise.all([
      nowPlayingMessages.get(guildId)?.delete().catch(() => null),
      lastAddedMessages.get(guildId)?.delete().catch(() => null),
    ]);
    nowPlayingMessages.delete(guildId);
    lastAddedMessages.delete(guildId);
    queue.delete();
    await interaction.deleteReply().catch(() => null);
  }

  // /music skip

  @Slash({ description: 'Skip the current track', name: 'skip' })
  async skip(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    const skipped = queue.currentTrack;
    queue.node.skip();
    await interaction.editReply({
      content: `⏭ Skipped **${skipped?.title ?? 'current track'}**.`,
    });
  }

  // /music previous

  @Slash({ description: 'Play the previous track', name: 'previous' })
  async previous(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = useQueue(interaction.guildId!);
    if (!queue) {
      await interaction.editReply({ content: '❌ Nothing is playing!' });
      return;
    }

    if (queue.history.isEmpty()) {
      await interaction.editReply({ content: '❌ No previous track in history.' });
      return;
    }

    await queue.history.back();
    await interaction.editReply({ content: '⏮ Playing previous track.' });
  }

  // /music pause

  @Slash({ description: 'Pause or resume playback', name: 'pause' })
  async pause(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    if (queue.node.isPaused()) {
      queue.node.resume();
      await interaction.editReply({ content: '▶ Resumed playback.' });
    } else {
      queue.node.pause();
      await interaction.editReply({ content: '⏸ Paused playback.' });
    }
  }

  // /music volume

  @Slash({ description: 'Set the playback volume (0–150)', name: 'volume' })
  async volume(
    @SlashOption({
      description: 'Volume percentage (0–150)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 0,
      maxValue: 150,
    })
    amount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    queue.node.setVolume(amount);
    const meta = queue.metadata as QueueMetadata | null;
    if (meta) meta.volume = amount;

    await interaction.editReply({ content: `🔊 Volume set to **${amount}%**.` });
  }

  // /music loop

  @Slash({ description: 'Set the loop mode', name: 'loop' })
  async loop(
    @SlashChoice({ name: 'Off',      value: 0 })
    @SlashChoice({ name: 'Track',    value: 1 })
    @SlashChoice({ name: 'Queue',    value: 2 })
    @SlashChoice({ name: 'Autoplay', value: 3 })
    @SlashOption({
      description: 'Loop mode',
      name: 'mode',
      required: true,
      type: ApplicationCommandOptionType.Integer,
    })
    mode: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    queue.setRepeatMode(mode as QueueRepeatMode);

    const labels = ['Off', 'Track 🔂', 'Queue 🔁', 'Autoplay ✨'];
    await interaction.editReply({ content: `🔁 Loop mode set to **${labels[mode] ?? 'Off'}**.` });
  }

  // /music shuffle

  @Slash({ description: 'Shuffle the current queue', name: 'shuffle' })
  async shuffle(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    if (queue.tracks.size < 2) {
      await interaction.editReply({ content: '❌ Need at least 2 tracks in queue to shuffle.' });
      return;
    }

    queue.tracks.shuffle();
    await interaction.editReply({ content: '🔀 Queue shuffled!' });
  }

  // /music queue

  @Slash({ description: 'Show the current queue', name: 'queue' })
  async queue(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = useQueue(interaction.guildId!);

    if (!queue?.currentTrack) {
      await interaction.editReply({ content: '❌ Nothing is playing right now!' });
      return;
    }

    const tracks = queue.tracks.toArray();
    const current = queue.currentTrack;

    const trackList = tracks
      .slice(0, 20)
      .map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) — ${t.duration}`)
      .join('\n') || '*Queue is empty*';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Current Queue')
      .addFields(
        {
          name: '▶ Now Playing',
          value: `[${current.title}](${current.url}) — ${current.duration}`,
        },
        {
          name: `📜 Up Next (${tracks.length} track${tracks.length !== 1 ? 's' : ''})`,
          value: trackList,
        },
      )
      .setFooter({
        text: tracks.length > 20 ? `…and ${tracks.length - 20} more tracks` : 'End of queue preview',
      });

    await interaction.editReply({ embeds: [embed] });
  }

  // /music nowplaying

  @Slash({ description: 'Show the now-playing dashboard', name: 'nowplaying' })
  async nowplaying(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    const track = queue.currentTrack!;
    const embed = buildNowPlayingEmbed(queue, track);
    const components = buildMusicComponents(queue);

    // Send a fresh public dashboard
    const msg = await (interaction.channel as TextChannel).send({
      embeds: [embed],
      components,
    });
    nowPlayingMessages.set(interaction.guildId!, msg);

    await interaction.editReply({ content: '✅ Dashboard sent!' });
  }

  // /music clear

  @Slash({ description: 'Clear all tracks from the queue (keeps current)', name: 'clear' })
  async clearQueue(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const queue = assertQueue(interaction);
    if (!queue) return;

    queue.clear();
    await interaction.editReply({ content: '🗑️ Queue cleared!' });
  }
}

//  Top-level /play shortcut (no subgroup)

@Discord()
export class PlayShortcut {
  @Slash({ description: 'Play a song or playlist', name: 'play' })
  async play(
    @SlashOption({
      description: 'Song name, YouTube/Spotify/SoundCloud URL, or playlist link',
      name: 'query',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    query: string,
    interaction: CommandInteraction,
    _client: Client,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId!;
    await lastAddedMessages.get(guildId)?.delete().catch(() => null);
    lastAddedMessages.delete(guildId);

    const voiceChannel = getVoiceChannel(interaction);
    if (!voiceChannel) {
      await interaction.editReply({ content: '❌ You must be in a voice channel first!' });
      return;
    }

    const player = useMainPlayer();

    try {
      const { track } = await player.play(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        voiceChannel as never,
        query,
        {
          nodeOptions: {
            metadata: {
              channel:     interaction.channel as TextChannel,
              requestedBy: interaction.user,
              volume:      80,
            } satisfies QueueMetadata,
            volume:               80,
            leaveOnEmpty:         true,
            leaveOnEmptyCooldown: 30_000,
            leaveOnEnd:           false,
            leaveOnEndCooldown:   10_000,
            selfDeaf:             true,
          },
        },
      );

      await interaction.deleteReply().catch(() => null);
      const msg = await (interaction.channel as TextChannel).send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setDescription(
              track.playlist
                ? `✅ Added playlist **${track.playlist.title}** to queue!`
                : `✅ Added **[${track.title}](${track.url})** to queue!`,
            ),
        ],
      });
      lastAddedMessages.set(guildId, msg);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await interaction.editReply({ content: `❌ ${errMsg}` });
    }
  }
}

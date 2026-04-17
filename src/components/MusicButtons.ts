import { type ButtonInteraction, MessageFlags } from 'discord.js';
import { ButtonComponent, Discord } from 'discordx';
import { QueueRepeatMode, useQueue } from 'discord-player';
import { buildNowPlayingEmbed, buildMusicComponents } from '../utils/MusicEmbed.js';
import { nowPlayingMessages, lastAddedMessages, type QueueMetadata } from '../utils/GuildState.js';

// Volume step (10% per press)
const VOL_STEP = 10;

async function refreshEmbed(interaction: ButtonInteraction): Promise<void> {
  const queue = useQueue(interaction.guildId!);
  if (!queue?.currentTrack) return;

  const embed      = buildNowPlayingEmbed(queue, queue.currentTrack);
  const components = buildMusicComponents(queue);
  await interaction.editReply({ embeds: [embed], components });
}

// Button Handlers

@Discord()
export class MusicButtons {

  // Stop

  @ButtonComponent({ id: 'music_stop' })
  async stop(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
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
  }

  // Previous

  @ButtonComponent({ id: 'music_prev' })
  async prev(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    if (queue.history.isEmpty()) {
      await interaction.followUp({ content: 'No previous track in history.', flags: MessageFlags.Ephemeral });
      return;
    }

    await queue.history.back();
    // Embed will be updated by the playerStart event
  }

  // Pause /  Resume 

  @ButtonComponent({ id: 'music_pause_resume' })
  async pauseResume(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    if (queue.node.isPaused()) {
      queue.node.resume();
    } else {
      queue.node.pause();
    }

    await refreshEmbed(interaction);
  }

  //  Next / Skip

  @ButtonComponent({ id: 'music_next' })
  async next(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    queue.node.skip();
    // Embed will be updated by the playerStart event
  }

  // Shuffle

  @ButtonComponent({ id: 'music_shuffle' })
  async shuffle(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    if (queue.tracks.size < 2) {
      await interaction.followUp({ content: 'Need at least 2 tracks in queue to shuffle.', flags: MessageFlags.Ephemeral });
      return;
    }

    queue.tracks.shuffle();
    await refreshEmbed(interaction);
  }

  // Loop (cycles: Off → Track → Queue → Autoplay → Off)

  @ButtonComponent({ id: 'music_loop' })
  async loop(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    const modes = [
      QueueRepeatMode.OFF,
      QueueRepeatMode.TRACK,
      QueueRepeatMode.QUEUE,
      QueueRepeatMode.AUTOPLAY,
    ] as const;

    const currentIndex = modes.indexOf(queue.repeatMode as typeof modes[number]);
    const nextMode     = modes[(currentIndex + 1) % modes.length]!;
    queue.setRepeatMode(nextMode);

    await refreshEmbed(interaction);
  }

  // Volume Down 

  @ButtonComponent({ id: 'music_vol_down' })
  async volDown(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    const meta    = queue.metadata as QueueMetadata | null;
    const current = meta?.volume ?? 80;
    const next    = Math.max(0, current - VOL_STEP);

    queue.node.setVolume(next);
    if (meta) meta.volume = next;

    await refreshEmbed(interaction);
  }

  // Volume Up

  @ButtonComponent({ id: 'music_vol_up' })
  async volUp(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    const meta    = queue.metadata as QueueMetadata | null;
    const current = meta?.volume ?? 80;
    const next    = Math.min(150, current + VOL_STEP);

    queue.node.setVolume(next);
    if (meta) meta.volume = next;

    await refreshEmbed(interaction);
  }
}

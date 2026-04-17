import { type StringSelectMenuInteraction, MessageFlags } from 'discord.js';
import { Discord, SelectMenuComponent } from 'discordx';
import { useQueue, type QueueFilters } from 'discord-player';
import { buildNowPlayingEmbed, buildMusicComponents } from '../utils/MusicEmbed.js';

// Select Menu Handlers

@Discord()
export class MusicMenus {

  // Queue Selector jump to any track in queue

  @SelectMenuComponent({ id: 'music_queue_select' })
  async queueSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: 'Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    // Value format: "qi_<index>"
    const index = parseInt(interaction.values[0]!.replace('qi_', ''), 10);
    if (isNaN(index)) return;

    // Jump to the selected position (0-based index in the upcoming queue)
    queue.node.jump(index);

    // Embed will update via playerStart event; just refresh components for now
    const embed      = buildNowPlayingEmbed(queue, queue.currentTrack!);
    const components = buildMusicComponents(queue);
    await interaction.editReply({ embeds: [embed], components });
  }

  // Audio Filter Selector

  @SelectMenuComponent({ id: 'music_filter_select' })
  async filterSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) {
      await interaction.followUp({ content: '❌ Nothing is playing!', flags: MessageFlags.Ephemeral });
      return;
    }

    const selected = interaction.values[0]!;

    try {
      if (selected === 'none') {
        // Disable all active FFmpeg filters
        const activeFilters = Object.entries(queue.filters.ffmpeg.toJSON())
          .filter(([, active]) => active)
          .map(([name]) => name);

        if (activeFilters.length > 0) {
          await queue.filters.ffmpeg.toggle(activeFilters as (keyof QueueFilters)[]);
        }
      } else {
        // Disable all current filters, then enable the selected one
        const currentFilters = queue.filters.ffmpeg.toJSON();
        const toDisable = Object.entries(currentFilters)
          .filter(([key, active]) => active && key !== selected)
          .map(([key]) => key);

        if (toDisable.length > 0) {
          await queue.filters.ffmpeg.toggle(toDisable as (keyof QueueFilters)[]);
        }

        // Toggle the selected filter on if it isn't already
        const isActive = currentFilters[selected as keyof typeof currentFilters];
        if (!isActive) {
          await queue.filters.ffmpeg.toggle([selected] as (keyof QueueFilters)[]);
        }
      }
    } catch (err) {
      console.error('[Filter Error]', err);
      await interaction.followUp({
        content: 'Could not apply filter. Make sure FFmpeg is installed.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed      = buildNowPlayingEmbed(queue, queue.currentTrack!);
    const components = buildMusicComponents(queue);
    await interaction.editReply({ embeds: [embed], components });
  }
}

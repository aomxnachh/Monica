import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits,
  type CommandInteraction,
  type TextChannel,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';

@Discord()
export class ClearCommand {
  @Slash({
    description: 'Bulk-delete messages in this channel (Admin only)',
    name: 'clear',
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
  })
  async clear(
    @SlashOption({
      description: 'Number of messages to delete (1–100)',
      name: 'amount',
      required: true,
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      maxValue: 100,
    })
    amount: number,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel as TextChannel;

    // Discord only allows bulk-delete for messages < 14 days old
    const deleted = await channel.bulkDelete(amount, true).catch(() => null);
    const count   = deleted?.size ?? 0;

    const embed = new EmbedBuilder()
      .setColor(count > 0 ? 0x57f287 : 0xed4245)
      .setDescription(
        count > 0
          ? `🗑️ Deleted **${count}** message${count !== 1 ? 's' : ''}.`
          : '❌ Could not delete messages (they may be older than 14 days).',
      );

    await interaction.editReply({ embeds: [embed] });
  }
}

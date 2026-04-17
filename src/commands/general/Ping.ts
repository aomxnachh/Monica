import { EmbedBuilder, type CommandInteraction } from 'discord.js';
import { Discord, Slash } from 'discordx';
import type { Client } from 'discordx';

@Discord()
export class PingCommand {
  @Slash({ description: 'Check bot latency and API ping', name: 'ping' })
  async ping(interaction: CommandInteraction, client: Client): Promise<void> {
    await interaction.deferReply();

    const roundtrip = Date.now() - interaction.createdTimestamp;
    const wsLatency = client.ws.ping;

    const bar = (ms: number): string => {
      if (ms < 100) return '🟢 Excellent';
      if (ms < 200) return '🟡 Good';
      if (ms < 400) return '🟠 Fair';
      return '🔴 Poor';
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⏱ Roundtrip',   value: `${roundtrip} ms — ${bar(roundtrip)}`, inline: true },
        { name: '📡 WebSocket',   value: `${wsLatency} ms — ${bar(wsLatency)}`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

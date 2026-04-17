import { EmbedBuilder, type CommandInteraction } from 'discord.js';
import { Discord, Slash } from 'discordx';
import process from 'node:process';

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

@Discord()
export class InfoCommand {
  @Slash({ description: 'Show bot stats: uptime, guilds, memory usage', name: 'info' })
  async info(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    const { client } = interaction;
    const mem   = process.memoryUsage();
    const uptime = formatUptime((client.uptime ?? 0));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: client.user!.tag,
        iconURL: client.user!.displayAvatarURL(),
      })
      .setTitle('📊 Bot Statistics')
      .addFields(
        { name: '⏱ Uptime',    value: uptime,                                   inline: true },
        { name: '🌐 Guilds',   value: `${client.guilds.cache.size}`,            inline: true },
        { name: '👥 Users',    value: `${client.users.cache.size}`,             inline: true },
        { name: '🧠 Heap',     value: formatBytes(mem.heapUsed),                inline: true },
        { name: '💾 RSS',      value: formatBytes(mem.rss),                     inline: true },
        { name: '📡 WS Ping', value: `${client.ws.ping} ms`,                   inline: true },
        { name: '📦 discord.js', value: '14.x',                                inline: true },
        { name: '🎵 discord-player', value: '6.x',                             inline: true },
        { name: '🤖 Framework', value: 'discordx 10.x',                        inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

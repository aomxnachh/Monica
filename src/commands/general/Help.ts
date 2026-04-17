import { EmbedBuilder, type CommandInteraction } from 'discord.js';
import { Discord, Slash } from 'discordx';

const COMMANDS = [
  {
    category: '🎵 Music',
    items: [
      { name: '/play `<query>`',      desc: 'Play a song, URL, or playlist' },
      { name: '/music play `<query>`', desc: 'Same as above (subcommand group)' },
      { name: '/music stop',           desc: 'Stop and clear the queue' },
      { name: '/music skip',           desc: 'Skip the current track' },
      { name: '/music previous',       desc: 'Play the previous track' },
      { name: '/music pause',          desc: 'Pause / resume playback' },
      { name: '/music volume `<0-150>`', desc: 'Adjust playback volume' },
      { name: '/music loop `<mode>`',  desc: 'Set loop mode (Off / Track / Queue / Autoplay)' },
      { name: '/music shuffle',        desc: 'Shuffle the queue' },
      { name: '/music queue',          desc: 'Display the current queue' },
      { name: '/music nowplaying',     desc: 'Resend the interactive Now Playing dashboard' },
      { name: '/music clear',          desc: 'Clear the queue (keeps current track)' },
    ],
  },
  {
    category: '🛠 General',
    items: [
      { name: '/ping',  desc: 'Check bot latency' },
      { name: '/help',  desc: 'Show this help message' },
      { name: '/info',  desc: 'Bot statistics and uptime' },
      { name: '/clear `<amount>`', desc: 'Bulk-delete messages (admin only)' },
    ],
  },
  {
    category: '🎚️ Interactive UI',
    items: [
      { name: 'Buttons (Now Playing)', desc: '⏹ Stop · ⏮ Prev · ⏸ Pause · ⏭ Next · 🔀 Shuffle' },
      { name: '🔁 Loop button',        desc: 'Cycles through Off → Track → Queue → Autoplay' },
      { name: '🔉 / 🔊 Volume',        desc: 'Decrease / increase volume by 10%' },
      { name: 'Queue dropdown',        desc: 'Jump to any track in the queue instantly' },
      { name: 'Filter dropdown',       desc: 'Apply audio effects (Bassboost, 8D, Nightcore, etc.)' },
    ],
  },
];

@Discord()
export class HelpCommand {
  @Slash({ description: 'Show all commands and how to use them', name: 'help' })
  async help(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Monica — Command Reference')
      .setDescription(
        'Monica is a feature-rich music bot with an **interactive Now Playing dashboard**.\n' +
        'Use buttons and dropdowns to control playback without typing commands.\n\u200B',
      )
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setFooter({ text: 'Monica Music Bot • discord-player + discordx' })
      .setTimestamp();

    for (const { category, items } of COMMANDS) {
      embed.addFields({
        name: category,
        value: items.map(i => `\`${i.name}\` — ${i.desc}`).join('\n'),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
}

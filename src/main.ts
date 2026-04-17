import 'reflect-metadata';
import { dirname, importx } from '@discordx/importer';
import { Client } from 'discordx';
import {
  ActivityType,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { config } from 'dotenv';
import { setupPlayer } from './utils/PlayerSetup.js';

config();

// Discord Client

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
  silent: false,
  // botGuilds: process.env.GUILD_ID ? [process.env.GUILD_ID] : undefined, // Uncomment for guild-scoped dev commands
});

// Forward all interactions to discordx
client.on('interactionCreate', interaction => {
  client.executeInteraction(interaction);
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('Missing BOT_TOKEN in .env — copy .env.example to .env and fill in the values.');
  }

  // Set up discord-player before importing commands (commands need the Player to exist)
  setupPlayer(client);

  // Auto-import all commands, events, and components via glob
  await importx(`${dirname(import.meta.url)}/{events,commands,components}/**/*.{ts,js}`);

  // Login
  await client.login(token);

  client.user?.setPresence({
    activities: [{ name: '/play • Monica', type: ActivityType.Listening }],
    status: 'online',
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});

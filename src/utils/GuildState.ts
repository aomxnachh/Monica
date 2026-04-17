import type { Message, TextChannel, User } from 'discord.js';

/**
 * Stores the "Now Playing" embed message per guild so we can edit it live
 * instead of sending new messages every track change.
 */
export const nowPlayingMessages  = new Map<string, Message>();
/** Tracks the latest "Added to queue" reply so we can delete it on the next add */
export const lastAddedMessages   = new Map<string, Message>();
/** Tracks the latest error message so stop can clean it up */
export const lastErrorMessages   = new Map<string, Message>();

/**
 * Metadata stored inside each GuildQueue so player events can access
 * the text channel and requester info.
 */
export interface QueueMetadata {
  channel: TextChannel;
  requestedBy: User;
  volume: number;
}

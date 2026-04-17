import { Discord, Once } from 'discordx';
import type { ArgsOf, Client } from 'discordx';

@Discord()
export class ReadyEvent {

  @Once({ event: 'ready' })
  async onReady([_readyClient]: ArgsOf<'ready'>, client: Client): Promise<void> {
    // Register / sync all slash commands
    await client.initApplicationCommands();

    console.log(`Logged in as ${client.user?.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guild(s)`);
  }
}

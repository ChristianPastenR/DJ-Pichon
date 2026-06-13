import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";

import { SlidingWindowCooldown } from "../commands/cooldown.js";
import { executeCommand, parseCommand } from "../commands/router.js";
import { handlePlayerControl } from "../discord/player-controls.js";
import {
  createAutocompleteHandler,
  handleSlashCommand,
  registerSlashCommands,
} from "../discord/slash-commands.js";
import { PlayerManager } from "../services/player/player-manager.js";
import { YouTubeClient } from "../services/youtube/youtube-client.js";

export function createMusicBot(config, logger) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
    ],
  });
  const youtube = new YouTubeClient(logger);
  const players = new PlayerManager(config, youtube, logger);
  const cooldown = new SlidingWindowCooldown({
    limit: 2,
    windowMilliseconds: 5000,
  });
  const handleAutocomplete = createAutocompleteHandler(youtube, logger);

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info(
      `Conectado como ${readyClient.user.tag} (${readyClient.user.id})`,
    );
    readyClient.user.setActivity("/play cancion", {
      type: ActivityType.Playing,
    });
    try {
      await registerSlashCommands(readyClient, config, logger);
    } catch (error) {
      logger.error("No se pudieron registrar los comandos slash:", error);
    }
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) {
      return;
    }
    if (
      config.discordChannelId &&
      message.channel.id !== config.discordChannelId
    ) {
      await message.reply(`Usa los comandos en <#${config.discordChannelId}>.`);
      return;
    }

    const parsed = parseCommand(message.content, config.commandPrefix);
    if (!parsed) {
      return;
    }

    try {
      await executeCommand({
        config,
        youtube,
        players,
        cooldown,
        message,
        ...parsed,
      });
    } catch (error) {
      logger.error(`Error ejecutando ${parsed.command}:`, error);
      await message.reply(
        error.message || "Ocurrio un error inesperado al ejecutar el comando.",
      );
    }
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      if (await handleAutocomplete(interaction)) {
        return;
      }
      if (await handlePlayerControl(interaction, players)) {
        return;
      }
      await handleSlashCommand(interaction, {
        config,
        youtube,
        players,
        cooldown,
      });
    } catch (error) {
      logger.error("Error procesando una interaccion de Discord:", error);
      const content =
        error.message || "Ocurrio un error inesperado al ejecutar el comando.";
      if (interaction.isAutocomplete()) {
        await interaction.respond([]).catch(() => {});
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ content }).catch(() => {});
      } else if (!interaction.replied) {
        await interaction
          .reply({ content, flags: MessageFlags.Ephemeral })
          .catch(() => {});
      } else {
        await interaction
          .followUp({ content, flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  });

  return {
    client,
    close() {
      players.close();
      client.destroy();
    },
  };
}

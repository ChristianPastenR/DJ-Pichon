import { ApplicationCommandOptionType, MessageFlags } from "discord.js";

import { executeCommand } from "../commands/router.js";
import { truncate } from "../shared/utils.js";

export const SLASH_COMMANDS = Object.freeze([
  {
    name: "play",
    description: "Busca o reproduce una cancion de YouTube",
    dm_permission: false,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: "cancion",
        description: "Escribe el nombre y elige una sugerencia",
        required: true,
        autocomplete: true,
      },
    ],
  },
  command("pause", "Pausa la reproduccion"),
  command("resume", "Continua la reproduccion"),
  command("skip", "Salta la cancion actual"),
  command("stop", "Detiene la reproduccion y vacia la cola"),
  command("queue", "Muestra la cola de canciones"),
  command("nowplaying", "Muestra la cancion actual"),
  command("leave", "Desconecta el bot del canal de voz"),
  command("help", "Muestra los comandos disponibles"),
]);

export async function registerSlashCommands(client, config, logger) {
  if (config.discordGuildId) {
    const guild = await client.guilds.fetch(config.discordGuildId);
    await guild.commands.set(SLASH_COMMANDS);
    logger.info(
      `Comandos slash registrados en el servidor ${config.discordGuildId}.`,
    );
    return;
  }

  const guilds = [...client.guilds.cache.values()];
  await Promise.all(guilds.map((guild) => guild.commands.set(SLASH_COMMANDS)));
  logger.info(`Comandos slash registrados en ${guilds.length} servidor(es).`);
}

export function createAutocompleteHandler(youtube, logger) {
  const cache = new Map();

  return async function handleAutocomplete(interaction) {
    if (!interaction.isAutocomplete() || interaction.commandName !== "play") {
      return false;
    }

    const query = interaction.options.getFocused().trim();
    if (query.length < 2) {
      await interaction.respond([]);
      return true;
    }

    try {
      const cached = cache.get(query.toLowerCase());
      let results;
      if (cached && cached.expiresAt > Date.now()) {
        results = cached.results;
      } else {
        results = await withTimeout(youtube.search(query, 10), 2400);
        cache.set(query.toLowerCase(), {
          results,
          expiresAt: Date.now() + 60_000,
        });
      }

      await interaction.respond(
        results.map((result) => ({
          name: truncate(result.title, 100),
          value: result.webpageUrl,
        })),
      );
    } catch (error) {
      logger.warn("No se pudo completar la sugerencia de YouTube:", error);
      await interaction.respond([]).catch(() => {});
    }
    return true;
  };
}

export async function handleSlashCommand(interaction, context) {
  if (!interaction.isChatInputCommand() || !interaction.guild) {
    return false;
  }

  if (
    context.config.discordChannelId &&
    interaction.channelId !== context.config.discordChannelId
  ) {
    await interaction.reply({
      content: `Usa los comandos en <#${context.config.discordChannelId}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const argument =
    interaction.commandName === "play"
      ? interaction.options.getString("cancion", true)
      : "";
  await interaction.deferReply({
    flags: MessageFlags.SuppressEmbeds,
  });

  await executeCommand({
    ...context,
    message: createMessageAdapter(interaction),
    command: interaction.commandName,
    argument,
  });
  return true;
}

function command(name, description) {
  return {
    name,
    description,
    dm_permission: false,
  };
}

function createMessageAdapter(interaction) {
  let answered = false;
  return {
    id: interaction.id,
    guild: interaction.guild,
    channel: interaction.channel,
    author: interaction.user,
    member: interaction.member,
    async reply(payload) {
      const options =
        typeof payload === "string" ? { content: payload } : { ...payload };
      options.flags ??= MessageFlags.SuppressEmbeds;

      if (!answered) {
        answered = true;
        return interaction.editReply(options);
      }
      return interaction.followUp(options);
    },
  };
}

function withTimeout(promise, milliseconds) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("La sugerencia de YouTube excedio el tiempo.")),
      milliseconds,
    );
    timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

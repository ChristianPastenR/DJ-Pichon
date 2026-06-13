import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";

import { formatDuration, truncate } from "../shared/utils.js";

export async function promptSearchResult({
  message,
  results,
  timeoutSeconds,
  commandPrefix,
  onSelect,
}) {
  const nonce = `${message.id}-${Date.now()}`;
  const selectId = `music-select:${nonce}`;
  const cancelId = `music-cancel:${nonce}`;
  const select = buildSelect(selectId, results);
  const cancel = new ButtonBuilder()
    .setCustomId(cancelId)
    .setLabel("Cancelar")
    .setStyle(ButtonStyle.Secondary);

  const response = await message.reply({
    embeds: [buildResultsEmbed(message, results, timeoutSeconds)],
    components: enabledComponents(select, cancel),
  });
  const collector = response.createMessageComponentCollector({
    time: timeoutSeconds * 1000,
  });
  let completed = false;

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== message.author.id) {
      await interaction.reply({
        content: "Solo quien hizo la busqueda puede elegir este resultado.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.customId === cancelId) {
      completed = true;
      collector.stop("cancelled");
      await interaction.update({
        content: "Busqueda cancelada.",
        embeds: [],
        components: disabledComponents(select, cancel),
      });
      return;
    }
    if (
      interaction.customId !== selectId ||
      interaction.componentType !== ComponentType.StringSelect
    ) {
      return;
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: "Entra a un canal de voz antes de elegir una cancion.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const result = results[Number.parseInt(interaction.values[0], 10)];
    try {
      const position = await onSelect(result, voiceChannel);
      completed = true;
      collector.stop("selected");
      const status =
        position === 1
          ? "Comenzando la reproduccion."
          : `Agregada a la cola en la posicion ${position}.`;
      await interaction.editReply({
        content: `Elegiste **${result.title}**. ${status}`,
        embeds: [],
        components: disabledComponents(select, cancel),
      });
    } catch (error) {
      await interaction.followUp({
        content: error.message,
        flags: MessageFlags.Ephemeral,
      });
    }
  });

  collector.on("end", async () => {
    if (completed) {
      return;
    }
    try {
      await response.edit({
        content:
          `La seleccion expiro. Ejecuta ` +
          `\`${commandPrefix}play\` nuevamente.`,
        embeds: [],
        components: disabledComponents(select, cancel),
      });
    } catch {
      // El mensaje pudo ser eliminado mientras el selector estaba activo.
    }
  });
}

function buildResultsEmbed(message, results, timeoutSeconds) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("Resultados de YouTube")
    .setDescription(
      results
        .map(
          (result, index) =>
            `\`${index + 1}.\` **${truncate(result.title, 70)}** ` +
            `\`${formatDuration(result.duration, {
              isLive: result.isLive,
            })}\``,
        )
        .join("\n"),
    )
    .setFooter({
      text:
        `Solo ${message.member.displayName} puede elegir. ` +
        `Expira en ${timeoutSeconds} s.`,
    });
}

function buildSelect(customId, results) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Elige una cancion...")
    .addOptions(
      results.map((result, index) => ({
        label: truncate(result.title, 100),
        value: String(index),
        description: truncate(
          `${result.uploader || "Canal desconocido"} | ` +
            formatDuration(result.duration, { isLive: result.isLive }),
          100,
        ),
      })),
    );
}

function enabledComponents(select, cancel) {
  return [
    new ActionRowBuilder().addComponents(select),
    new ActionRowBuilder().addComponents(cancel),
  ];
}

function disabledComponents(select, cancel) {
  return [
    new ActionRowBuilder().addComponents(
      StringSelectMenuBuilder.from(select).setDisabled(true),
    ),
    new ActionRowBuilder().addComponents(
      ButtonBuilder.from(cancel).setDisabled(true),
    ),
  ];
}

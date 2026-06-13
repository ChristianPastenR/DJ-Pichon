import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";

import { formatDuration, truncate } from "../shared/utils.js";

const CONTROL_IDS = Object.freeze({
  pause: "music:pause",
  resume: "music:resume",
  skip: "music:skip",
  stop: "music:stop",
  queue: "music:queue",
});

export function buildPlayerControls({ disabled = false } = {}) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(CONTROL_IDS.pause)
        .setLabel("Pausa")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(CONTROL_IDS.resume)
        .setLabel("Play")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(CONTROL_IDS.skip)
        .setLabel("Saltar")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(CONTROL_IDS.stop)
        .setLabel("Stop")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(CONTROL_IDS.queue)
        .setLabel("Cola")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    ),
  ];
}

export async function handlePlayerControl(interaction, players) {
  if (!interaction.isButton()) {
    return false;
  }

  const action = Object.entries(CONTROL_IDS).find(
    ([, customId]) => customId === interaction.customId,
  )?.[0];
  if (!action) {
    return false;
  }

  const player = players.get(interaction.guild.id);
  if (action === "queue") {
    await interaction.reply({
      content: formatQueue(player.snapshot()),
      flags: MessageFlags.Ephemeral | MessageFlags.SuppressEmbeds,
    });
    return true;
  }

  const memberChannelId = interaction.member?.voice?.channelId;
  const botChannelId = interaction.guild.members.me?.voice?.channelId;
  if (!memberChannelId || memberChannelId !== botChannelId) {
    await interaction.reply({
      content: "Debes estar en el mismo canal de voz que el bot.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (action === "stop") {
    player.stop({ disconnect: true });
    await interaction.update({
      content: "Reproduccion detenida y cola vaciada.",
      components: buildPlayerControls({ disabled: true }),
    });
    return true;
  }

  let result;
  if (action === "pause") {
    result = player.pause()
      ? "Reproduccion pausada."
      : "No hay una cancion reproduciendose.";
  } else if (action === "resume") {
    result = player.resume()
      ? "Reproduccion reanudada."
      : "No hay una cancion pausada.";
  } else {
    result = player.skip()
      ? "Cancion saltada."
      : "No hay una cancion para saltar.";
  }
  await interaction.reply({
    content: result,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

function formatQueue({ current, queued }) {
  if (!current && queued.length === 0) {
    return "La cola esta vacia.";
  }

  const lines = [];
  if (current) {
    lines.push(`**Ahora:** ${truncate(current.title, 80)}`);
  }
  lines.push(
    ...queued
      .slice(0, 10)
      .map(
        (track, index) =>
          `\`${index + 1}.\` ${truncate(track.title, 75)} ` +
          `\`${formatDuration(track.duration, { isLive: track.isLive })}\``,
      ),
  );
  if (queued.length > 10) {
    lines.push(`... y ${queued.length - 10} canciones mas.`);
  }
  return lines.join("\n");
}

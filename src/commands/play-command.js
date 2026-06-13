import { promptSearchResult } from "../discord/search-selector.js";
import { QueueFullError } from "../services/player/guild-player.js";
import { isHttpUrl } from "../shared/utils.js";

export async function executePlay({
  config,
  youtube,
  players,
  cooldown,
  message,
  argument,
}) {
  const player = players.get(message.guild.id);
  if (!argument) {
    await message.reply(
      player.resume()
        ? "Reproduccion reanudada."
        : `Uso: \`${config.commandPrefix}play nombre de cancion\``,
    );
    return;
  }

  const retryAfter = cooldown.consume(message.author.id);
  if (retryAfter > 0) {
    await message.reply(
      `Espera ${(retryAfter / 1000).toFixed(1)} segundos antes de repetir.`,
    );
    return;
  }

  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) {
    await message.reply("Entra a un canal de voz antes de buscar una cancion.");
    return;
  }

  await message.channel.sendTyping();
  if (isHttpUrl(argument)) {
    const result = await youtube.getResult(argument);
    await enqueueResult({ message, voiceChannel, player, result });
    return;
  }

  const results = await youtube.search(argument, 10);
  await promptSearchResult({
    message,
    results,
    timeoutSeconds: config.selectionTimeoutSeconds,
    commandPrefix: config.commandPrefix,
    onSelect: (result, selectedVoiceChannel) =>
      enqueueResult({
        message,
        voiceChannel: selectedVoiceChannel,
        player,
        result,
        announce: false,
      }),
  });
}

async function enqueueResult({
  message,
  voiceChannel,
  player,
  result,
  announce = true,
}) {
  await player.ensureVoice(voiceChannel);
  const track = {
    title: result.title,
    webpageUrl: result.webpageUrl,
    duration: result.duration,
    requesterId: message.author.id,
    requesterName: message.member.displayName,
    uploader: result.uploader,
    thumbnail: result.thumbnail,
    isLive: result.isLive,
  };

  let position;
  try {
    position = await player.enqueue(track, message.channel);
  } catch (error) {
    if (error instanceof QueueFullError) {
      throw error;
    }
    throw new Error("No pude agregar la cancion a la cola.", { cause: error });
  }

  if (announce) {
    const status =
      position === 1
        ? "Comenzando la reproduccion."
        : `Agregada a la cola en la posicion ${position}.`;
    await message.reply(`**${track.title}**. ${status}`);
  }
  return position;
}

import { formatDuration, truncate } from "../shared/utils.js";

export const playbackCommands = {
  pause({ players, message }) {
    const player = players.get(message.guild.id);
    return message.reply(
      player.pause()
        ? "Reproduccion pausada."
        : "No hay una cancion reproduciendose.",
    );
  },

  resume({ players, message }) {
    const player = players.get(message.guild.id);
    return message.reply(
      player.resume()
        ? "Reproduccion reanudada."
        : "No hay una cancion pausada.",
    );
  },

  skip({ players, message }) {
    const player = players.get(message.guild.id);
    return message.reply(
      player.skip() ? "Cancion saltada." : "No hay una cancion para saltar.",
    );
  },

  stop({ players, message }) {
    players.get(message.guild.id).stop({ disconnect: true });
    return message.reply("Reproduccion detenida y cola vaciada.");
  },

  leave({ players, message }) {
    players.get(message.guild.id).stop({ disconnect: true });
    return message.reply("Desconectado del canal de voz.");
  },

  queue({ players, message }) {
    const { current, queued } = players.get(message.guild.id).snapshot();
    if (!current && queued.length === 0) {
      return message.reply("La cola esta vacia.");
    }

    const lines = [];
    if (current) {
      lines.push(`**Ahora:** ${truncate(current.title, 80)}`);
    }
    lines.push(
      ...queued.slice(0, 10).map(
        (track, index) =>
          `\`${index + 1}.\` ${truncate(track.title, 75)} ` +
          `\`${formatDuration(track.duration, {
            isLive: track.isLive,
          })}\``,
      ),
    );
    if (queued.length > 10) {
      lines.push(`... y ${queued.length - 10} canciones mas.`);
    }
    return message.reply(lines.join("\n"));
  },

  nowplaying({ players, message }) {
    const { current } = players.get(message.guild.id).snapshot();
    if (!current) {
      return message.reply("No hay una cancion reproduciendose.");
    }
    return message.reply(
      `Sonando: **${current.title}** ` +
        `\`${formatDuration(current.duration, {
          isLive: current.isLive,
        })}\``,
    );
  },

  help({ config, message }) {
    const prefix = config.commandPrefix;
    return message.reply(
      [
        "**Comandos de musica**",
        "`/play cancion:` - muestra sugerencias mientras escribes",
        `\`${prefix}play nombre\` - busca 10 resultados en YouTube`,
        `\`${prefix}play URL\` - agrega directamente un enlace`,
        `\`${prefix}pause\` / \`${prefix}resume\` - pausa o continua`,
        `\`${prefix}skip\` - salta la cancion actual`,
        `\`${prefix}stop\` - detiene, vacia la cola y desconecta`,
        `\`${prefix}queue\` - muestra la cola`,
        `\`${prefix}nowplaying\` - muestra lo que esta sonando`,
      ].join("\n"),
    );
  },
};

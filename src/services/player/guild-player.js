import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import { MessageFlags } from "discord.js";

import { buildPlayerControls } from "../../discord/player-controls.js";
import { formatDuration } from "../../shared/utils.js";
import { YouTubeError } from "../youtube/youtube-client.js";
import { createFfmpegProcess } from "./ffmpeg.js";

export class QueueFullError extends Error {
  constructor(limit) {
    super(`La cola alcanzo el limite de ${limit} canciones.`);
    this.name = "QueueFullError";
  }
}

export class GuildPlayer {
  constructor({ guildId, youtube, maxQueueSize, idleTimeoutSeconds, logger }) {
    this.guildId = guildId;
    this.youtube = youtube;
    this.maxQueueSize = maxQueueSize;
    this.idleTimeoutMilliseconds = idleTimeoutSeconds * 1000;
    this.logger = logger;

    this.queue = [];
    this.current = null;
    this.textChannel = null;
    this.connection = null;
    this.ffmpeg = null;
    this.generation = 0;
    this.idleTimer = null;

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.#disposeFfmpeg();
      this.current = null;
      void this.#playNext();
    });
    this.audioPlayer.on("error", (error) => {
      this.logger.warn(
        `Error de audio en el servidor ${this.guildId}:`,
        error.message,
      );
      this.#disposeFfmpeg();
      this.current = null;
      this.audioPlayer.stop(true);
      void this.#send("FFmpeg no pudo terminar la cancion actual.");
    });
  }

  async ensureVoice(channel) {
    const existing = getVoiceConnection(this.guildId);
    if (existing && existing.joinConfig.channelId !== channel.id) {
      if (this.current) {
        throw new Error("Ya estoy reproduciendo musica en otro canal de voz.");
      }
      existing.destroy();
    }

    this.connection =
      getVoiceConnection(this.guildId) ??
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
      this.connection.destroy();
      this.connection = null;
      throw new Error(
        "No pude conectarme al canal de voz. Revisa mis permisos.",
        { cause: error },
      );
    }
    this.connection.subscribe(this.audioPlayer);
  }

  async enqueue(track, textChannel) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new QueueFullError(this.maxQueueSize);
    }

    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.textChannel = textChannel;
    this.queue.push(track);
    const position = this.queue.length + (this.current ? 1 : 0);

    if (
      !this.current &&
      this.audioPlayer.state.status === AudioPlayerStatus.Idle
    ) {
      void this.#playNext();
    }
    return position;
  }

  pause() {
    return this.audioPlayer.pause();
  }

  resume() {
    return this.audioPlayer.unpause();
  }

  skip() {
    if (!this.current) {
      return false;
    }
    this.generation += 1;
    this.#disposeFfmpeg();
    this.audioPlayer.stop(true);
    return true;
  }

  stop({ disconnect = true } = {}) {
    const hadContent = Boolean(this.current || this.queue.length);
    this.queue = [];
    this.current = null;
    this.generation += 1;
    this.#disposeFfmpeg();
    this.audioPlayer.stop(true);
    clearTimeout(this.idleTimer);
    this.idleTimer = null;

    if (disconnect) {
      this.disconnect();
    }
    return hadContent;
  }

  disconnect() {
    const connection = getVoiceConnection(this.guildId);
    if (connection) {
      connection.destroy();
    }
    this.connection = null;
  }

  snapshot() {
    return {
      current: this.current,
      queued: [...this.queue],
    };
  }

  async #playNext() {
    if (
      this.current ||
      this.audioPlayer.state.status !== AudioPlayerStatus.Idle
    ) {
      return;
    }

    const track = this.queue.shift();
    if (!track) {
      this.#scheduleIdleDisconnect();
      return;
    }

    const generation = this.generation;
    this.current = track;

    try {
      const resolved = await this.youtube.resolveStream(track.webpageUrl);
      if (generation !== this.generation || this.current !== track) {
        return;
      }

      const connection = getVoiceConnection(this.guildId);
      if (!connection) {
        throw new Error("Se perdio la conexion con el canal de voz.");
      }

      this.ffmpeg = createFfmpegProcess(resolved.streamUrl);
      this.ffmpeg.on("error", (error) => {
        this.logger.warn("No se pudo iniciar FFmpeg:", error.message);
      });
      this.ffmpeg.stderr.on("data", (chunk) => {
        this.logger.debug("FFmpeg:", chunk.toString("utf8").trim());
      });

      const resource = createAudioResource(this.ffmpeg.stdout, {
        inputType: StreamType.OggOpus,
        metadata: track,
      });
      this.audioPlayer.play(resource);

      const duration = formatDuration(resolved.duration, {
        isLive: resolved.isLive,
      });
      await this.#send(
        `Reproduciendo: **${resolved.title}** ` +
          `\`${duration}\`\nPedido por **${track.requesterName}**`,
        { controls: true },
      );
    } catch (error) {
      this.current = null;
      this.#disposeFfmpeg();
      const detail =
        error instanceof YouTubeError
          ? error.message
          : "Error de reproduccion.";
      await this.#send(`No pude reproducir **${track.title}**: ${detail}`);
      void this.#playNext();
    }
  }

  #scheduleIdleDisconnect() {
    if (this.idleTimer) {
      return;
    }
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.current && this.queue.length === 0) {
        this.disconnect();
      }
    }, this.idleTimeoutMilliseconds);
    this.idleTimer.unref();
  }

  #disposeFfmpeg() {
    if (this.ffmpeg && !this.ffmpeg.killed) {
      this.ffmpeg.kill();
    }
    this.ffmpeg = null;
  }

  async #send(content, { controls = false } = {}) {
    if (!this.textChannel) {
      return;
    }
    try {
      await this.textChannel.send({
        content,
        components: controls ? buildPlayerControls() : [],
        flags: MessageFlags.SuppressEmbeds,
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo escribir en el canal del servidor ${this.guildId}:`,
        error.message,
      );
    }
  }
}

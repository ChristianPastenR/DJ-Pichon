import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";
import youtubeDl from "youtube-dl-exec";

import { asInteger, isHttpUrl } from "../../shared/utils.js";

const BASE_FLAGS = Object.freeze({
  ignoreConfig: true,
  noWarnings: true,
  jsRuntimes: "node",
});
const PLAYER_CLIENTS = Object.freeze(["web_safari", "mweb", "web_embedded"]);

export class YouTubeError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "YouTubeError";
  }
}

export class YouTubeClient {
  constructor(logger, executor = youtubeDl) {
    this.logger = logger;
    this.executor = executor;
  }

  async search(query, limit = 10) {
    const info = await this.#execute(`ytsearch${limit}:${query}`, {
      ...BASE_FLAGS,
      skipDownload: true,
      dumpSingleJson: true,
      flatPlaylist: true,
      playlistEnd: limit,
    });

    const results = (info.entries ?? [])
      .map((entry) => this.#toSearchResult(entry))
      .filter(Boolean)
      .slice(0, limit);

    if (results.length === 0) {
      throw new YouTubeError("No se encontraron resultados para esa busqueda.");
    }
    return results;
  }

  async getResult(url) {
    const info = await this.#executeWithPlayerClients(url, {
      ...BASE_FLAGS,
      noPlaylist: true,
      skipDownload: true,
      dumpSingleJson: true,
    });
    const result = this.#toSearchResult(info);
    if (!result) {
      throw new YouTubeError("El enlace no contiene un video reproducible.");
    }
    return result;
  }

  async resolveStream(url) {
    const info = await this.#executeWithPlayerClients(url, {
      ...BASE_FLAGS,
      noPlaylist: true,
      skipDownload: true,
      dumpSingleJson: true,
      format: "bestaudio[acodec!=none]/bestaudio/best",
    });

    if (!info.url) {
      throw new YouTubeError(
        "YouTube no entrego un formato de audio reproducible.",
      );
    }

    return {
      streamUrl: info.url,
      title: info.title || "Titulo desconocido",
      webpageUrl: info.webpage_url || url,
      duration: asInteger(info.duration),
      uploader: info.uploader || info.channel || null,
      thumbnail: info.thumbnail || null,
      isLive: Boolean(info.is_live || info.live_status === "is_live"),
    };
  }

  async downloadMp3(
    url,
    outputDirectory,
    { audioQuality = "0", section = null } = {},
  ) {
    const directory = path.resolve(outputDirectory);
    await mkdir(directory, { recursive: true });

    const flags = {
      ...BASE_FLAGS,
      noPlaylist: true,
      format: "bestaudio[acodec!=none]/bestaudio/best",
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: String(audioQuality),
      ffmpegLocation: ffmpegPath,
      paths: directory,
      output: "%(title).150B-%(id)s.%(ext)s",
      print: "after_move:filepath",
    };
    if (section) {
      flags.downloadSections = section;
    }

    this.logger.debug("Descargando MP3 con dependencias npm", { url, flags });
    const output = await this.#executeWithPlayerClients(url, flags, {
      failureMessage: "No pude descargar y convertir el audio a MP3.",
    });

    const printedPath = String(output)
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1);
    if (!printedPath) {
      throw new YouTubeError("yt-dlp no informo el archivo MP3 generado.");
    }

    const filePath = path.isAbsolute(printedPath)
      ? printedPath
      : path.resolve(directory, printedPath);
    const file = await stat(filePath).catch(() => null);
    if (!file?.isFile() || file.size === 0) {
      throw new YouTubeError("El archivo MP3 no fue generado correctamente.");
    }

    return {
      filePath,
      sizeBytes: file.size,
    };
  }

  async #execute(target, flags) {
    this.logger.debug("Ejecutando youtube-dl-exec", { target, flags });
    try {
      return await this.executor(target, flags);
    } catch (error) {
      this.logger.warn("Fallo youtube-dl-exec:", error.message);
      throw new YouTubeError("YouTube no pudo completar la solicitud.", {
        cause: error,
      });
    }
  }

  async #executeWithPlayerClients(
    target,
    flags,
    { failureMessage = "YouTube no pudo completar la solicitud." } = {},
  ) {
    const errors = [];
    for (const playerClient of PLAYER_CLIENTS) {
      const clientFlags = {
        ...flags,
        extractorArgs: `youtube:player_client=${playerClient}`,
      };
      this.logger.debug("Probando cliente publico de YouTube", {
        target,
        playerClient,
      });
      try {
        return await this.executor(target, clientFlags);
      } catch (error) {
        errors.push(`${playerClient}: ${error.message}`);
        this.logger.warn(`Fallo el cliente ${playerClient}:`, error.message);
      }
    }

    throw new YouTubeError(failureMessage, {
      cause: new AggregateError(errors, "Fallaron los clientes de YouTube."),
    });
  }

  #toSearchResult(info) {
    if (!info) {
      return null;
    }

    let webpageUrl = info.webpage_url;
    if (!webpageUrl && typeof info.url === "string" && isHttpUrl(info.url)) {
      webpageUrl = info.url;
    }
    if (!webpageUrl && info.id) {
      webpageUrl = `https://www.youtube.com/watch?v=${info.id}`;
    }
    if (!webpageUrl) {
      return null;
    }

    const thumbnails = info.thumbnails ?? [];
    return {
      title: info.title || "Titulo desconocido",
      webpageUrl,
      duration: asInteger(info.duration),
      uploader: info.uploader || info.channel || null,
      thumbnail: info.thumbnail || thumbnails.at(-1)?.url || null,
      isLive: Boolean(info.is_live || info.live_status === "is_live"),
    };
  }
}

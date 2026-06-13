import { spawn } from "node:child_process";

import ffmpegPath from "ffmpeg-static";

export const FFMPEG_PATH = ffmpegPath;

export function createFfmpegProcess(streamUrl) {
  return spawn(
    FFMPEG_PATH,
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "warning",
      "-reconnect",
      "1",
      "-reconnect_streamed",
      "1",
      "-reconnect_delay_max",
      "5",
      "-i",
      streamUrl,
      "-vn",
      "-map_metadata",
      "-1",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "128k",
      "-f",
      "ogg",
      "pipe:1",
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

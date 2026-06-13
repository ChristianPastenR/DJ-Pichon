import { COMMAND_ALIASES } from "./aliases.js";
import { executePlay } from "./play-command.js";
import { playbackCommands } from "./playback-commands.js";

export function parseCommand(content, prefix) {
  if (!content.startsWith(prefix)) {
    return null;
  }
  const body = content.slice(prefix.length).trim();
  if (!body) {
    return null;
  }

  const separator = body.indexOf(" ");
  const rawCommand = (
    separator === -1 ? body : body.slice(0, separator)
  ).toLowerCase();
  return {
    command: COMMAND_ALIASES.get(rawCommand) ?? rawCommand,
    argument: separator === -1 ? "" : body.slice(separator + 1).trim(),
  };
}

export async function executeCommand(context) {
  if (context.command === "play") {
    await executePlay(context);
    return;
  }
  const command = playbackCommands[context.command];
  if (command) {
    await command(context);
  }
}

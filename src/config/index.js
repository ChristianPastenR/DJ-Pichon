function positiveInteger(name, defaultValue) {
  const rawValue = process.env[name] ?? String(defaultValue);
  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un numero entero mayor que cero.`);
  }
  return value;
}

function optionalSnowflake(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    return null;
  }
  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} debe ser un ID valido de Discord.`);
  }
  return value;
}

export function loadConfig() {
  const discordToken = process.env.DISCORD_TOKEN?.trim();
  if (!discordToken) {
    throw new Error("Falta la variable de entorno DISCORD_TOKEN.");
  }

  const commandPrefix = process.env.COMMAND_PREFIX?.trim() || "!";
  return Object.freeze({
    discordToken,
    commandPrefix,
    discordChannelId: optionalSnowflake("DISCORD_CHANNEL_ID"),
    discordGuildId: optionalSnowflake("DISCORD_GUILD_ID"),
    maxQueueSize: positiveInteger("MAX_QUEUE_SIZE", 100),
    selectionTimeoutSeconds: positiveInteger("SELECTION_TIMEOUT_SECONDS", 90),
    idleTimeoutSeconds: positiveInteger("IDLE_TIMEOUT_SECONDS", 300),
    logLevel: process.env.LOG_LEVEL?.trim().toLowerCase() || "info",
  });
}

import "dotenv/config";

import { createMusicBot } from "./app/music-bot.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./shared/logger.js";

let bot;

try {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  bot = createMusicBot(config, logger);

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      logger.info(`Recibida senal ${signal}; cerrando el bot.`);
      bot.close();
      process.exit(0);
    });
  }

  await bot.client.login(config.discordToken);
} catch (error) {
  console.error(error);
  bot?.close();
  process.exitCode = 1;
}

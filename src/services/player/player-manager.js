import { GuildPlayer } from "./guild-player.js";

export class PlayerManager {
  constructor(config, youtube, logger) {
    this.config = config;
    this.youtube = youtube;
    this.logger = logger;
    this.players = new Map();
  }

  get(guildId) {
    let player = this.players.get(guildId);
    if (!player) {
      player = new GuildPlayer({
        guildId,
        youtube: this.youtube,
        maxQueueSize: this.config.maxQueueSize,
        idleTimeoutSeconds: this.config.idleTimeoutSeconds,
        logger: this.logger,
      });
      this.players.set(guildId, player);
    }
    return player;
  }

  close() {
    for (const player of this.players.values()) {
      player.stop({ disconnect: true });
    }
    this.players.clear();
  }
}

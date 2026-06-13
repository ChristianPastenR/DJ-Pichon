export class SlidingWindowCooldown {
  constructor({ limit, windowMilliseconds }) {
    this.limit = limit;
    this.windowMilliseconds = windowMilliseconds;
    this.entries = new Map();
  }

  consume(key, now = Date.now()) {
    const timestamps = (this.entries.get(key) ?? []).filter(
      (timestamp) => now - timestamp < this.windowMilliseconds,
    );
    if (timestamps.length >= this.limit) {
      return this.windowMilliseconds - (now - timestamps[0]);
    }
    this.entries.set(key, [...timestamps, now]);
    return 0;
  }
}

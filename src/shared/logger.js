const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
});

export function createLogger(levelName = "info") {
  const threshold = LEVELS[levelName] ?? LEVELS.info;

  function write(level, ...args) {
    if (LEVELS[level] < threshold) {
      return;
    }
    const method = level === "debug" ? "log" : level;
    console[method](new Date().toISOString(), level.toUpperCase(), ...args);
  }

  return Object.freeze({
    debug: (...args) => write("debug", ...args),
    info: (...args) => write("info", ...args),
    warn: (...args) => write("warn", ...args),
    error: (...args) => write("error", ...args),
  });
}

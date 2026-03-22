function timestamp() {
  return new Date().toISOString();
}

function createLogger(level = "info") {
  const levelOrder = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  const currentLevel = Object.prototype.hasOwnProperty.call(levelOrder, level)
    ? level
    : "info";

  function shouldLog(targetLevel) {
    return levelOrder[targetLevel] <= levelOrder[currentLevel];
  }

  function write(targetLevel, message, meta) {
    if (!shouldLog(targetLevel)) {
      return;
    }

    const parts = [`[${timestamp()}]`, `[${targetLevel.toUpperCase()}]`, message];
    if (meta !== undefined) {
      parts.push(typeof meta === "string" ? meta : JSON.stringify(meta));
    }
    console.log(parts.join(" "));
  }

  return {
    error(message, meta) {
      write("error", message, meta);
    },
    warn(message, meta) {
      write("warn", message, meta);
    },
    info(message, meta) {
      write("info", message, meta);
    },
    debug(message, meta) {
      write("debug", message, meta);
    },
  };
}

module.exports = {
  createLogger,
};

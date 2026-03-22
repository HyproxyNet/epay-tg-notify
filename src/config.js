const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getConfigFilePath(projectRoot) {
  const configPath = path.join(projectRoot, "config", "config.json");
  if (fs.existsSync(configPath)) {
    return configPath;
  }

  const examplePath = path.join(projectRoot, "config", "config.example.json");
  if (fs.existsSync(examplePath)) {
    return examplePath;
  }

  throw new Error("Missing config/config.json");
}

function parsePhpConfig(phpConfigPath) {
  if (!fs.existsSync(phpConfigPath)) {
    throw new Error(`PHP config not found: ${phpConfigPath}`);
  }

  const content = fs.readFileSync(phpConfigPath, "utf8");
  const pick = (key) => {
    const pattern = new RegExp(`'${key}'\\s*=>\\s*(?:'([^']*)'|(\\d+))`);
    const match = content.match(pattern);
    if (!match) {
      throw new Error(`Unable to read '${key}' from ${phpConfigPath}`);
    }
    return match[1] ?? match[2];
  };

  return {
    host: pick("host"),
    port: Number(pick("port")),
    user: pick("user"),
    password: pick("pwd"),
    database: pick("dbname"),
    prefix: pick("dbqz"),
  };
}

function normalizeAdminIds(adminIds) {
  if (!Array.isArray(adminIds)) {
    return [];
  }
  return adminIds.map((item) => String(item));
}

function resolveDatabaseConfig(rawConfig, projectRoot) {
  const database = rawConfig.database || {};
  const mode = database.mode || "php-config";

  if (mode === "php-config") {
    const phpConfigPath = path.resolve(projectRoot, database.phpConfigPath || "../config.php");
    return {
      mode,
      ...parsePhpConfig(phpConfigPath),
    };
  }

  if (mode === "manual") {
    const connection = database.connection || {};
    return {
      mode,
      host: connection.host,
      port: Number(connection.port || 3306),
      user: connection.user,
      password: connection.password || "",
      database: connection.database,
      prefix: connection.prefix || "pay",
    };
  }

  throw new Error(`Unsupported database mode: ${mode}`);
}

function loadAppConfig() {
  const projectRoot = path.resolve(__dirname, "..");
  const configPath = getConfigFilePath(projectRoot);
  const rawConfig = readJson(configPath);
  const database = resolveDatabaseConfig(rawConfig, projectRoot);

  const appConfig = {
    projectRoot,
    configPath,
    telegram: {
      botToken: String(rawConfig.telegram?.botToken || "").trim(),
      adminIds: normalizeAdminIds(rawConfig.telegram?.adminIds),
    },
    database,
    polling: {
      intervalMs: Number(rawConfig.polling?.intervalMs || 5000),
      batchSize: Number(rawConfig.polling?.batchSize || 50),
      lookbackDays: Number(rawConfig.polling?.lookbackDays || 7),
      statuses: Array.isArray(rawConfig.polling?.statuses)
        ? rawConfig.polling.statuses.map((item) => Number(item))
        : [1, 3],
      onlyAfterBinding: rawConfig.polling?.onlyAfterBinding === true,
    },
    app: {
      timezone: rawConfig.app?.timezone || "Asia/Shanghai",
      logLevel: rawConfig.app?.logLevel || "info",
    },
  };

  if (!appConfig.telegram.botToken || appConfig.telegram.botToken === "replace_with_your_bot_token") {
    throw new Error(`Invalid Telegram bot token in ${configPath}`);
  }
  if (!appConfig.database.host || !appConfig.database.user || !appConfig.database.database) {
    throw new Error(`Invalid database configuration in ${configPath}`);
  }
  if (!appConfig.database.prefix) {
    throw new Error(`Missing database prefix in ${configPath}`);
  }

  return appConfig;
}

module.exports = {
  loadAppConfig,
};

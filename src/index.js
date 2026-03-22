const { Telegraf } = require("telegraf");
const { loadAppConfig } = require("./config");
const { createLogger } = require("./logger");
const { createPoolFromConfig } = require("./db");
const { ensureSchema } = require("./schema");
const { createMerchantRepository } = require("./repositories/merchantRepository");
const { createBindingRepository } = require("./repositories/bindingRepository");
const { createOrderRepository } = require("./repositories/orderRepository");
const { createBindingService } = require("./services/bindingService");
const { createNotificationService } = require("./services/notificationService");
const { createBotHandlers, registerPublicCommands } = require("./bot");

function createRepositories(pool, prefix) {
  return {
    merchantRepository: createMerchantRepository(pool, prefix),
    bindingRepository: createBindingRepository(pool, prefix),
    orderRepository: createOrderRepository(pool, prefix),
  };
}

function installProcessSignals({ bot, notificationService, pool, logger }) {
  async function shutdown(signal) {
    logger.warn(`Received ${signal}, shutting down`);
    notificationService.stop();
    await bot.stop(signal);
    await pool.end();
    process.exit(0);
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      shutdown(signal).catch((error) => {
        logger.error("Shutdown failed", error.message);
        process.exit(1);
      });
    });
  }
}

function startBackgroundTasks({ bot, logger, notificationService, pollingConfig }) {
  logger.info("Registering public bot commands");
  registerPublicCommands(bot, logger).catch((error) => {
    logger.error("Register public commands failed", error.message);
  });

  logger.info("Launching Telegram bot");
  bot.launch()
    .then(() => {
      logger.info("Telegram bot launched");
    })
    .catch((error) => {
      logger.error("Telegram bot launch failed", error.message);
    });

  notificationService.start();
  logger.info(`Order polling started, interval=${pollingConfig.intervalMs}ms`);
  notificationService.pollOnce().catch((error) => {
    logger.error("Initial polling failed", error.message);
  });
}

async function main() {
  const appConfig = loadAppConfig();
  const logger = createLogger(appConfig.app.logLevel);

  logger.info(`Loading config from ${appConfig.configPath}`);

  const pool = createPoolFromConfig(appConfig.database);
  await ensureSchema(pool, appConfig.database.prefix);
  logger.info("Database connection established and schema ensured");

  const repositories = createRepositories(pool, appConfig.database.prefix);
  const bindingService = createBindingService({
    pool,
    merchantRepository: repositories.merchantRepository,
    bindingRepository: repositories.bindingRepository,
  });

  const bot = new Telegraf(appConfig.telegram.botToken);
  bot.catch((error) => {
    logger.error("Unhandled Telegram bot error", error.message);
  });

  createBotHandlers({
    bot,
    bindingService,
    adminIds: appConfig.telegram.adminIds,
    logger,
  });

  const notificationService = createNotificationService({
    bot,
    orderRepository: repositories.orderRepository,
    pollingConfig: appConfig.polling,
    timeZone: appConfig.app.timezone,
    logger,
  });

  installProcessSignals({
    bot,
    notificationService,
    pool,
    logger,
  });

  startBackgroundTasks({
    bot,
    logger,
    notificationService,
    pollingConfig: appConfig.polling,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

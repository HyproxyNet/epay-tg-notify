const { tableName } = require("./db");

async function ensureSchema(pool, prefix) {
  const bindingTable = tableName(prefix, "tg_binding");
  const notifyLogTable = tableName(prefix, "tg_notify_log");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${bindingTable} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      merchant_uid INT UNSIGNED NOT NULL,
      chat_id BIGINT NOT NULL,
      tg_user_id BIGINT NOT NULL,
      tg_username VARCHAR(64) DEFAULT NULL,
      tg_first_name VARCHAR(128) DEFAULT NULL,
      tg_last_name VARCHAR(128) DEFAULT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_merchant_uid (merchant_uid),
      UNIQUE KEY uniq_tg_user_id (tg_user_id),
      KEY idx_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${notifyLogTable} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      trade_no CHAR(19) NOT NULL,
      merchant_uid INT UNSIGNED NOT NULL,
      chat_id BIGINT NOT NULL,
      tg_user_id BIGINT NOT NULL,
      sent_at DATETIME NOT NULL,
      message_text TEXT DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_trade_no (trade_no),
      KEY idx_merchant_uid (merchant_uid),
      KEY idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = {
  ensureSchema,
};

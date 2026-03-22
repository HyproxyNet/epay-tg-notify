const { tableName } = require("../db");

function createBindingRepository(pool, prefix) {
  const bindingTable = tableName(prefix, "tg_binding");
  const userTable = tableName(prefix, "user");

  return {
    async findByTelegramUserId(tgUserId) {
      const [rows] = await pool.query(
        `
          SELECT *
          FROM ${bindingTable}
          WHERE tg_user_id = ?
          LIMIT 1
        `,
        [tgUserId]
      );
      return rows[0] || null;
    },

    async findByMerchantUid(merchantUid) {
      const [rows] = await pool.query(
        `
          SELECT *
          FROM ${bindingTable}
          WHERE merchant_uid = ?
          LIMIT 1
        `,
        [merchantUid]
      );
      return rows[0] || null;
    },

    async deleteByTelegramUserId(executor, tgUserId) {
      await executor.query(
        `
          DELETE FROM ${bindingTable}
          WHERE tg_user_id = ?
        `,
        [tgUserId]
      );
    },

    async deleteByMerchantUid(executor, merchantUid) {
      await executor.query(
        `
          DELETE FROM ${bindingTable}
          WHERE merchant_uid = ?
        `,
        [merchantUid]
      );
    },

    async insertBinding(executor, binding) {
      await executor.query(
        `
          INSERT INTO ${bindingTable}
          (
            merchant_uid,
            chat_id,
            tg_user_id,
            tg_username,
            tg_first_name,
            tg_last_name,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          binding.merchantUid,
          binding.chatId,
          binding.tgUserId,
          binding.tgUsername,
          binding.tgFirstName,
          binding.tgLastName,
        ]
      );
    },

    async listRecentBindings(limit = 20) {
      const [rows] = await pool.query(
        `
          SELECT
            b.merchant_uid,
            b.chat_id,
            b.tg_user_id,
            b.tg_username,
            b.tg_first_name,
            b.tg_last_name,
            b.created_at,
            u.account,
            u.username
          FROM ${bindingTable} b
          LEFT JOIN ${userTable} u ON u.uid = b.merchant_uid
          ORDER BY b.updated_at DESC
          LIMIT ?
        `,
        [limit]
      );
      return rows;
    },
  };
}

module.exports = {
  createBindingRepository,
};

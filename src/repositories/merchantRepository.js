const { tableName } = require("../db");

function createMerchantRepository(pool, prefix) {
  const userTable = tableName(prefix, "user");

  return {
    async findByCredentials(merchantUid, merchantKey) {
      const [rows] = await pool.query(
        `
          SELECT uid, account, username, email, status, pay
          FROM ${userTable}
          WHERE uid = ? AND \`key\` = ?
          LIMIT 1
        `,
        [merchantUid, merchantKey]
      );
      return rows[0] || null;
    },
  };
}

module.exports = {
  createMerchantRepository,
};

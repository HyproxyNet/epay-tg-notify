const { tableName } = require("../db");

function createOrderRepository(pool, prefix) {
  const orderTable = tableName(prefix, "order");
  const bindingTable = tableName(prefix, "tg_binding");
  const notifyLogTable = tableName(prefix, "tg_notify_log");
  const typeTable = tableName(prefix, "type");

  return {
    async findPendingPaidOrders({ statuses, lookbackDays, batchSize, onlyAfterBinding }) {
      const safeStatuses = Array.isArray(statuses) && statuses.length > 0 ? statuses : [1, 3];
      const statusPlaceholders = safeStatuses.map(() => "?").join(", ");
      const bindingFilter = onlyAfterBinding ? "AND o.endtime >= b.created_at" : "";

      const [rows] = await pool.query(
        `
          SELECT
            o.trade_no,
            o.out_trade_no,
            o.api_trade_no,
            o.uid,
            o.name,
            o.money,
            o.realmoney,
            o.getmoney,
            o.buyer,
            o.param,
            o.status,
            o.endtime,
            o.date,
            t.showname AS type_name,
            b.chat_id,
            b.tg_user_id
          FROM ${orderTable} o
          INNER JOIN ${bindingTable} b ON b.merchant_uid = o.uid
          LEFT JOIN ${notifyLogTable} n ON n.trade_no = o.trade_no
          LEFT JOIN ${typeTable} t ON t.id = o.type
          WHERE n.trade_no IS NULL
            AND o.endtime IS NOT NULL
            ${bindingFilter}
            AND o.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            AND o.status IN (${statusPlaceholders})
          ORDER BY o.endtime ASC, o.trade_no ASC
          LIMIT ?
        `,
        [lookbackDays, ...safeStatuses, batchSize]
      );

      return rows;
    },

    async markOrderNotified(order, messageText) {
      await pool.query(
        `
          INSERT IGNORE INTO ${notifyLogTable}
          (
            trade_no,
            merchant_uid,
            chat_id,
            tg_user_id,
            sent_at,
            message_text
          )
          VALUES (?, ?, ?, ?, NOW(), ?)
        `,
        [order.trade_no, order.uid, order.chat_id, order.tg_user_id, messageText]
      );
    },
  };
}

module.exports = {
  createOrderRepository,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatMoney(value) {
  return `\u00a5${escapeHtml(value)}`;
}

function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function buildOrderMessage(order, timeZone) {
  const lines = [
    "<b>\u8ba2\u5355\u652f\u4ed8\u6210\u529f</b>",
    `\u5546\u6237ID\uff1a<code>${escapeHtml(order.uid)}</code>`,
    `\u7cfb\u7edf\u5355\u53f7\uff1a<code>${escapeHtml(order.trade_no)}</code>`,
    `\u5546\u6237\u5355\u53f7\uff1a<code>${escapeHtml(order.out_trade_no)}</code>`,
    `\u5546\u54c1\u540d\u79f0\uff1a${escapeHtml(order.name)}`,
    `\u8ba2\u5355\u91d1\u989d\uff1a${formatMoney(order.money)}`,
  ];

  if (order.realmoney !== null && order.realmoney !== undefined) {
    lines.push(`\u5b9e\u4ed8\u91d1\u989d\uff1a${formatMoney(order.realmoney)}`);
  }
  if (order.getmoney !== null && order.getmoney !== undefined) {
    lines.push(`\u5546\u6237\u5165\u8d26\uff1a${formatMoney(order.getmoney)}`);
  }
  if (order.type_name) {
    lines.push(`\u652f\u4ed8\u65b9\u5f0f\uff1a${escapeHtml(order.type_name)}`);
  }
  if (order.api_trade_no) {
    lines.push(`\u6e20\u9053\u5355\u53f7\uff1a<code>${escapeHtml(order.api_trade_no)}</code>`);
  }
  if (order.buyer) {
    lines.push(`\u4ed8\u6b3e\u8d26\u53f7\uff1a${escapeHtml(order.buyer)}`);
  }
  if (order.param) {
    lines.push(`\u8ba2\u5355\u5907\u6ce8\uff1a${escapeHtml(order.param)}`);
  }

  lines.push(`\u652f\u4ed8\u65f6\u95f4\uff1a${escapeHtml(formatDateTime(order.endtime, timeZone))}`);
  return lines.join("\n");
}

function createNotificationService({
  bot,
  orderRepository,
  pollingConfig,
  timeZone,
  logger,
}) {
  let timer = null;
  let isRunning = false;

  async function pollOnce() {
    if (isRunning) {
      return {
        skipped: true,
        reason: "already_running",
        total: 0,
        sent: 0,
        failed: 0,
      };
    }

    isRunning = true;

    try {
      const orders = await orderRepository.findPendingPaidOrders({
        statuses: pollingConfig.statuses,
        lookbackDays: pollingConfig.lookbackDays,
        batchSize: pollingConfig.batchSize,
        onlyAfterBinding: pollingConfig.onlyAfterBinding,
      });

      let sent = 0;
      let failed = 0;

      if (orders.length > 0) {
        logger.info(`Polling orders, found ${orders.length} pending records`);
      }

      for (const order of orders) {
        const messageText = buildOrderMessage(order, timeZone);

        try {
          await bot.telegram.sendMessage(order.chat_id, messageText, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
          await orderRepository.markOrderNotified(order, messageText);
          logger.info(`Notification sent for trade_no=${order.trade_no}`);
          sent += 1;
        } catch (error) {
          logger.error(`Notification failed for trade_no=${order.trade_no}`, error.message);
          failed += 1;
        }
      }

      return {
        skipped: false,
        total: orders.length,
        sent,
        failed,
      };
    } finally {
      isRunning = false;
    }
  }

  function start() {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      pollOnce().catch((error) => {
        logger.error("Polling task crashed", error.message);
      });
    }, pollingConfig.intervalMs);
  }

  function stop() {
    if (!timer) {
      return;
    }

    clearInterval(timer);
    timer = null;
  }

  return {
    pollOnce,
    start,
    stop,
  };
}

module.exports = {
  createNotificationService,
};

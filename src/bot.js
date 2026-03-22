const { BindingServiceError } = require("./services/bindingService");

const PUBLIC_COMMANDS = [
  { command: "start", description: "\u5f00\u59cb\u4f7f\u7528\u673a\u5668\u4eba" },
  { command: "help", description: "\u67e5\u770b\u5e2e\u52a9" },
  { command: "bind", description: "\u7ed1\u5b9a\u5546\u6237" },
  { command: "unbind", description: "\u89e3\u9664\u7ed1\u5b9a" },
  { command: "me", description: "\u67e5\u770b\u5f53\u524d\u7ed1\u5b9a" },
];

const ADMIN_COMMANDS = [
  { command: "bindings", description: "\u67e5\u770b\u6700\u8fd1\u7ed1\u5b9a\u5217\u8868" },
];

const PUBLIC_HELP_LINES = [
  "\u4f7f\u7528\u8bf4\u660e\uff1a",
  "/bind \u5546\u6237ID \u5546\u6237\u5bc6\u94a5  \u7ed1\u5b9a\u5546\u6237",
  "/unbind  \u89e3\u9664\u5f53\u524d\u7ed1\u5b9a",
  "/me  \u67e5\u770b\u5f53\u524d\u7ed1\u5b9a",
  "/help  \u67e5\u770b\u5e2e\u52a9",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPrivateChat(ctx) {
  return ctx.chat && ctx.chat.type === "private";
}

function formatUserName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || String(user.id);
}

function parseCommandArgs(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .slice(1);
}

function createTelegramUserPayload(ctx) {
  return {
    chatId: ctx.chat.id,
    tgUserId: ctx.from.id,
    tgUsername: ctx.from.username || null,
    tgFirstName: ctx.from.first_name || null,
    tgLastName: ctx.from.last_name || null,
  };
}

function formatDateValue(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function formatHelpText(isAdminUser) {
  const lines = [...PUBLIC_HELP_LINES];

  if (isAdminUser) {
    lines.push("");
    lines.push("\u7ba1\u7406\u5458\u547d\u4ee4\uff1a");
    for (const command of ADMIN_COMMANDS) {
      lines.push(`/${command.command}  ${command.description}`);
    }
  }

  return lines.join("\n");
}

async function registerCommandScope(bot, logger, extraOptions) {
  const scopeName = extraOptions ? "all_private_chats" : "default";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await bot.telegram.setMyCommands(PUBLIC_COMMANDS, extraOptions);
      logger.info(`Registered ${PUBLIC_COMMANDS.length} public bot commands for ${scopeName} scope`);
      return;
    } catch (error) {
      logger.error(
        `Register public commands failed (scope=${scopeName}, attempt=${attempt})`,
        error.message
      );

      if (attempt < 3) {
        await sleep(attempt * 1000);
      }
    }
  }

  throw new Error(`Unable to register public commands for ${scopeName} scope`);
}

async function registerPublicCommands(bot, logger) {
  await registerCommandScope(bot, logger, undefined);
  await registerCommandScope(bot, logger, { scope: { type: "all_private_chats" } });
}

function createBotHandlers({ bot, bindingService, adminIds, logger }) {
  const adminSet = new Set(adminIds.map((item) => String(item)));

  function isAdmin(ctx) {
    return ctx.from && adminSet.has(String(ctx.from.id));
  }

  async function requirePrivateChat(ctx) {
    if (isPrivateChat(ctx)) {
      return true;
    }

    await ctx.reply("\u8bf7\u5728\u548c\u673a\u5668\u4eba\u7684\u79c1\u804a\u7a97\u53e3\u91cc\u4f7f\u7528\u8fd9\u4e2a\u6307\u4ee4\u3002");
    return false;
  }

  bot.start(async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    await ctx.reply([
      `\u4f60\u597d\uff0c${formatUserName(ctx.from)}\u3002`,
      "",
      formatHelpText(isAdmin(ctx)),
    ].join("\n"));
  });

  bot.help(async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    await ctx.reply(formatHelpText(isAdmin(ctx)));
  });

  bot.command("bind", async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    const args = parseCommandArgs(ctx.message?.text);
    if (args.length < 2) {
      await ctx.reply("\u7528\u6cd5\uff1a/bind \u5546\u6237ID \u5546\u6237\u5bc6\u94a5");
      return;
    }

    const merchantUid = Number(args[0]);
    const merchantKey = args[1];

    if (!Number.isInteger(merchantUid) || merchantUid <= 0) {
      await ctx.reply("\u5546\u6237ID\u683c\u5f0f\u4e0d\u6b63\u786e\u3002");
      return;
    }

    try {
      const result = await bindingService.bind(createTelegramUserPayload(ctx), merchantUid, merchantKey);
      const merchantName = result.merchant.username || result.merchant.account || `UID ${result.merchant.uid}`;

      await ctx.reply([
        "\u7ed1\u5b9a\u6210\u529f\u3002",
        `\u5f53\u524d\u5546\u6237\uff1a${merchantName}`,
        `\u5546\u6237ID\uff1a${result.merchant.uid}`,
        "\u5982\u679c\u8be5\u5546\u6237\u6216\u5f53\u524d Telegram \u8d26\u53f7\u4e4b\u524d\u5b58\u5728\u65e7\u7ed1\u5b9a\uff0c\u65e7\u7ed1\u5b9a\u5df2\u81ea\u52a8\u5931\u6548\u3002",
      ].join("\n"));
      logger.info(`Binding updated for merchant_uid=${merchantUid}, tg_user_id=${ctx.from.id}`);
    } catch (error) {
      if (error instanceof BindingServiceError) {
        await ctx.reply(error.message);
        return;
      }

      logger.error("Bind command failed", error.message);
      await ctx.reply("\u7ed1\u5b9a\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002");
    }
  });

  bot.command("unbind", async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    try {
      const removed = await bindingService.unbind(ctx.from.id);
      await ctx.reply(
        removed
          ? "\u5f53\u524d\u7ed1\u5b9a\u5df2\u89e3\u9664\u3002"
          : "\u5f53\u524d\u6ca1\u6709\u53ef\u89e3\u9664\u7684\u7ed1\u5b9a\u3002"
      );
    } catch (error) {
      logger.error("Unbind command failed", error.message);
      await ctx.reply("\u89e3\u7ed1\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002");
    }
  });

  bot.command("me", async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    try {
      const binding = await bindingService.getCurrentBinding(ctx.from.id);
      if (!binding) {
        await ctx.reply("\u5f53\u524d\u672a\u7ed1\u5b9a\u5546\u6237\u3002");
        return;
      }

      await ctx.reply([
        "\u5f53\u524d\u7ed1\u5b9a\u4fe1\u606f\uff1a",
        `\u5546\u6237ID\uff1a${binding.merchant_uid}`,
        `Telegram ID\uff1a${binding.tg_user_id}`,
        `\u7ed1\u5b9a\u65f6\u95f4\uff1a${formatDateValue(binding.created_at)}`,
      ].join("\n"));
    } catch (error) {
      logger.error("Me command failed", error.message);
      await ctx.reply("\u8bfb\u53d6\u7ed1\u5b9a\u4fe1\u606f\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002");
    }
  });

  bot.command("bindings", async (ctx) => {
    if (!(await requirePrivateChat(ctx))) {
      return;
    }

    if (!isAdmin(ctx)) {
      await ctx.reply("\u8be5\u6307\u4ee4\u4ec5\u7ba1\u7406\u5458\u53ef\u7528\u3002");
      return;
    }

    try {
      const rows = await bindingService.listRecentBindings(20);
      if (rows.length === 0) {
        await ctx.reply("\u5f53\u524d\u6ca1\u6709\u7ed1\u5b9a\u8bb0\u5f55\u3002");
        return;
      }

      const lines = ["\u6700\u8fd1\u7ed1\u5b9a\uff1a"];
      for (const row of rows) {
        const merchantName = row.username || row.account || `UID ${row.merchant_uid}`;
        const telegramName = row.tg_username
          ? `@${row.tg_username}`
          : [row.tg_first_name, row.tg_last_name].filter(Boolean).join(" ") || row.tg_user_id;

        lines.push(`${row.merchant_uid} -> ${telegramName} | ${merchantName} | ${formatDateValue(row.created_at)}`);
      }

      await ctx.reply(lines.join("\n"));
    } catch (error) {
      logger.error("Bindings command failed", error.message);
      await ctx.reply("\u8bfb\u53d6\u7ed1\u5b9a\u5217\u8868\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002");
    }
  });
}

module.exports = {
  createBotHandlers,
  registerPublicCommands,
};

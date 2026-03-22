const { withTransaction } = require("../db");

class BindingServiceError extends Error {}

function createBindingService({ pool, merchantRepository, bindingRepository }) {
  return {
    async bind(telegramUser, merchantUid, merchantKey) {
      const merchant = await merchantRepository.findByCredentials(merchantUid, merchantKey);
      if (!merchant) {
        throw new BindingServiceError("\u5546\u6237ID\u6216\u5546\u6237\u5bc6\u94a5\u9519\u8bef\u3002");
      }
      if (Number(merchant.status) === 0 || Number(merchant.pay) === 0) {
        throw new BindingServiceError("\u8be5\u5546\u6237\u5df2\u88ab\u7981\u7528\uff0c\u6682\u65f6\u4e0d\u80fd\u7ed1\u5b9a\u3002");
      }

      const oldUserBinding = await bindingRepository.findByTelegramUserId(telegramUser.tgUserId);
      const oldMerchantBinding = await bindingRepository.findByMerchantUid(merchantUid);

      await withTransaction(pool, async (connection) => {
        await bindingRepository.deleteByTelegramUserId(connection, telegramUser.tgUserId);
        await bindingRepository.deleteByMerchantUid(connection, merchantUid);
        await bindingRepository.insertBinding(connection, {
          merchantUid,
          chatId: telegramUser.chatId,
          tgUserId: telegramUser.tgUserId,
          tgUsername: telegramUser.tgUsername,
          tgFirstName: telegramUser.tgFirstName,
          tgLastName: telegramUser.tgLastName,
        });
      });

      return {
        merchant,
        oldUserBinding,
        oldMerchantBinding,
      };
    },

    async unbind(tgUserId) {
      const currentBinding = await bindingRepository.findByTelegramUserId(tgUserId);
      if (!currentBinding) {
        return false;
      }

      await withTransaction(pool, async (connection) => {
        await bindingRepository.deleteByTelegramUserId(connection, tgUserId);
      });

      return true;
    },

    async getCurrentBinding(tgUserId) {
      return bindingRepository.findByTelegramUserId(tgUserId);
    },

    async listRecentBindings(limit) {
      return bindingRepository.listRecentBindings(limit);
    },
  };
}

module.exports = {
  BindingServiceError,
  createBindingService,
};

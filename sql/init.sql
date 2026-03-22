-- Replace pre_ with your actual table prefix if your epay prefix is not pre_.

CREATE TABLE IF NOT EXISTS `pre_tg_binding` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `merchant_uid` int unsigned NOT NULL,
  `chat_id` bigint NOT NULL,
  `tg_user_id` bigint NOT NULL,
  `tg_username` varchar(64) DEFAULT NULL,
  `tg_first_name` varchar(128) DEFAULT NULL,
  `tg_last_name` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_merchant_uid` (`merchant_uid`),
  UNIQUE KEY `uniq_tg_user_id` (`tg_user_id`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pre_tg_notify_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `trade_no` char(19) NOT NULL,
  `merchant_uid` int unsigned NOT NULL,
  `chat_id` bigint NOT NULL,
  `tg_user_id` bigint NOT NULL,
  `sent_at` datetime NOT NULL,
  `message_text` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_trade_no` (`trade_no`),
  KEY `idx_merchant_uid` (`merchant_uid`),
  KEY `idx_sent_at` (`sent_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

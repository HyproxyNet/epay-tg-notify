# epay Telegram Bot

Standalone Node.js Telegram bot for reading the epay MySQL database and pushing paid-order notifications to bound merchants.

## Features

- Configure one or more Telegram admin IDs
- Bind a merchant with `/bind <merchantId> <merchantKey>`
- Keep only one active Telegram binding per merchant
- Keep only one active merchant binding per Telegram user
- Automatically invalidate the previous binding when a user rebinds
- Poll the database and push successful order notifications
- Let admins inspect recent bindings with `/bindings`

## Project Layout

```text
telegram-bot/
|-- config/
|   |-- config.example.json
|   `-- config.json
|-- docs/
|   `-- epay-order-logic.md
|-- sql/
|   `-- init.sql
|-- src/
|   |-- repositories/
|   |-- services/
|   |-- bot.js
|   |-- config.js
|   |-- db.js
|   |-- index.js
|   |-- logger.js
|   `-- schema.js
|-- .gitignore
|-- package.json
`-- README.md
```

## Requirements

- Node.js 20+
- MySQL reachable from the bot runtime
- A valid Telegram bot token

## Install

```bash
cd telegram-bot
npm install
```

## Configure

Create a local config from the example:

```bash
copy config\\config.example.json config\\config.json
```

Update `config/config.json` to match your environment.

### Example

```json
{
  "telegram": {
    "botToken": "replace_with_your_bot_token",
    "adminIds": [123456789]
  },
  "database": {
    "mode": "php-config",
    "phpConfigPath": "../config.php",
    "connection": {
      "host": "127.0.0.1",
      "port": 3306,
      "user": "root",
      "password": "",
      "database": "",
      "prefix": "pay"
    }
  },
  "polling": {
    "intervalMs": 5000,
    "batchSize": 50,
    "lookbackDays": 7,
    "statuses": [1, 3],
    "onlyAfterBinding": true
  },
  "app": {
    "timezone": "Asia/Shanghai",
    "logLevel": "info"
  }
}
```

### Database Modes

`php-config`
- Read database credentials from the epay `config.php`
- Useful when the bot directory sits next to the PHP project

`manual`
- Use explicit MySQL connection settings
- Better for standalone containers or separate servers

## Run

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Syntax check:

```bash
npm run check
```

## Commands

Public commands:

- `/start`
- `/help`
- `/bind <merchantId> <merchantKey>`
- `/unbind`
- `/me`

Admin-only commands:

- `/bindings`

Notes:

- Only public commands are registered into the Telegram bot menu at startup
- Admin users see the full command list when they run `/help`

## Notification Rules

- By default, only orders created after the binding time are pushed
- A paid order must satisfy:
  - `pre_order.status in (1, 3)`
  - `pre_order.endtime` is not null
- `*_tg_notify_log` is used for de-duplication
- Query lookback is controlled by `polling.lookbackDays`

## Database Tables

The bot creates these tables automatically at startup:

- `*_tg_binding`
- `*_tg_notify_log`

If you prefer manual SQL, run:

- `sql/init.sql`

## Relation To epay

- Merchant authentication comes from `pre_user.uid + pre_user.key`
- Paid-order semantics follow the existing epay PHP flow
- See `docs/epay-order-logic.md` for the analyzed order path

## Deployment Notes

- Treat this folder as a standalone Node project
- Running it in a separate container is recommended
- `database.mode = "manual"` is usually the safer container setup

## Git Notes

This folder includes a dedicated `.gitignore` and ignores:

- `node_modules/`
- `config/config.json`
- log files
- IDE metadata

If you initialize this directory as its own Git repository, commit:

- `config/config.example.json`
- `src/`
- `sql/`
- `docs/`
- `package.json`
- `package-lock.json`
- `README.md`

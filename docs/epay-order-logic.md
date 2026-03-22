# epay 订单与数据库逻辑梳理

## 1. 数据库入口

- PHP 全局入口在 `includes/common.php`。
- 数据库配置来自根目录 `config.php` 的 `$dbconfig`。
- PDO 封装在 `includes/lib/PdoHelper.php`，会自动把 SQL 里的 `pre_` 替换成实际前缀 `${dbqz}_`。

## 2. 核心表

- `pre_user`
  - 商户主表。
  - 机器人绑定鉴权直接使用 `uid + key`。
- `pre_order`
  - 支付订单主表。
  - 关键字段：
    - `trade_no`: 平台订单号，主键
    - `out_trade_no`: 商户订单号
    - `uid`: 商户 ID
    - `type`: 支付方式 ID
    - `channel` / `subchannel`: 通道
    - `money`: 商户提交金额
    - `realmoney`: 实际支付金额
    - `getmoney`: 商户入账金额
    - `status`: 订单状态
    - `notify`: 异步通知状态
    - `addtime`: 创建时间
    - `endtime`: 支付完成时间
    - `date`: 支付完成日期
    - `buyer`: 付款账号/openid
- `pre_type`
  - 支付方式字典表，`id -> name/showname`。
- `pre_record`
  - 商户余额流水。
- `pre_refundorder`
  - 退款流水。
- `pre_suborder`
  - 合单/分账时的子订单。

## 3. 创建订单流程

主要入口：

- 页面提单：`includes/lib/api/Pay.php::submit()`
- API 提单：`includes/lib/api/Pay.php::create()`

核心过程：

1. 读取 `pre_user`，校验 `uid`、签名、商户状态、金额限制、域名白名单等。
2. 先按 `uid + out_trade_no` 查重：
   - 已存在且未过期，复用旧订单。
   - 不存在则向 `pre_order` 插入一条 `status = 0` 的新订单。
3. 通过 `lib\Channel::submit()` 选择支付方式、通道、费率。
4. 计算：
   - `realmoney`: 实际支付金额
   - `getmoney`: 商户入账金额
5. 回写 `pre_order.type/channel/subchannel/realmoney/getmoney`。
6. 调用插件生成支付链接或收银页。

## 4. 支付成功流程

统一入口：

- `includes/functions.php`
  - `processNotify(...)`
  - `processReturn(...)`
- 二者都进入 `includes/lib/Payment.php::processOrder()`

成功处理逻辑：

1. 当订单 `status` 为 `0` 或 `4` 时，先执行：
   - `pre_order.status = 1`
   - 回写 `api_trade_no`
   - 回写 `buyer`
   - 回写 `endtime`
   - 回写 `date`
2. 然后调用全局函数 `processOrder($order, $isnotify)`。
3. `processOrder()` 内再做：
   - 计算平台利润 `profitmoney`
   - 给商户加余额或扣手续费
   - 发起商户异步通知 `notify_url`
   - 发送站内原有消息通知 `MsgNotice::send('order', ...)`
   - 处理邀请返佣、分账、通道日限额等逻辑

结论：

- 对 Bot 来说，订单“支付成功”的可靠判断条件是：
  - `pre_order.status in (1, 3)`
  - `pre_order.endtime is not null`
- 其中 `3` 是后续人工冻结后的已支付订单，成功事实不变。

## 5. 订单状态语义

- `0`: 未支付
- `1`: 已支付成功
- `2`: 已退款
- `3`: 已支付但被冻结
- `4`: 某些插件/流程里的过渡状态，最终仍会转成 `1`

## 6. 商户鉴权结论

项目原生接口 `api.php`、`includes/lib/api/Pay.php` 都基于商户表 `pre_user`：

- 商户 ID：`pre_user.uid`
- 商户密钥：`pre_user.key`

因此 Telegram Bot 绑定逻辑可以直接复用这组凭据，不需要再改 PHP 老代码。

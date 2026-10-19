// What each table and column of the practice dataset means. Shown next to every drill and trap
// (the tables the query reads, the columns it touches, three sample rows), so the context is on the card.
//
// Keep this file free of imports and of non-erasable TypeScript: scripts load it with Node's type stripping.

export interface L {
  en: string;
  ru: string;
}

export const columnInfo: Record<string, Record<string, L>> = {
  merchants: {
    _: { en: 'merchants (12 rows): businesses that sell subscriptions on the platform', ru: 'продавцы (12 строк): компании, которые продают подписки через платформу' },
    id: { en: 'key: mer_01 …', ru: 'ключ: mer_01 …' },
    name: { en: 'company name (made up)', ru: 'название компании (вымышленное)' },
    country: { en: "merchant's country", ru: 'страна продавца' },
    advances_enrolled_at: { en: 'when the merchant joined the advances program; NULL = not enrolled', ru: 'когда продавец подключился к программе авансов; NULL = не подключён' },
  },
  products: {
    _: { en: 'products (20 rows); a merchant can own several', ru: 'продукты (20 строк); у продавца может быть несколько' },
    id: { en: 'key: prd_01 …', ru: 'ключ: prd_01 …' },
    merchant_id: { en: '→ merchants.id', ru: '→ merchants.id' },
    name: { en: 'product name', ru: 'название продукта' },
  },
  transactions: {
    _: { en: 'one row = one paid (or trial) period of a subscription', ru: 'одна строка = один оплаченный (или триальный) период подписки' },
    transaction_id: { en: 'unique id of the transaction', ru: 'уникальный id транзакции' },
    original_transaction_id: { en: 'id of the first transaction of the chain: all renewals of one subscription share it', ru: 'id первой транзакции цепочки: все продления одной подписки' },
    customer_id: { en: 'the customer', ru: 'клиент (покупатель)' },
    product_id: { en: '→ products.id', ru: '→ products.id' },
    plan_id: { en: 'plan, e.g. prd_03.monthly', ru: 'тариф, например prd_03.monthly' },
    plan_period: { en: 'P1W / P1M / P1Y', ru: 'P1W / P1M / P1Y' },
    channel: { en: 'north_market / south_market (partner marketplaces) / web (own checkout) / promo (free access, price 0)', ru: 'north_market / south_market (маркетплейсы-партнёры) / web (оплата на сайте) / promo (бесплатный доступ, цена 0)' },
    is_trial: { en: 'free trial (7 days, price 0)', ru: 'бесплатный триал (7 дней, цена 0)' },
    is_trial_conversion: { en: 'first paid period right after a trial', ru: 'первый платный период сразу после триала' },
    renewal_number: { en: '1 = first purchase of the chain, then 2, 3 … for renewals', ru: '1 — первая покупка цепочки, 2, 3 … — продления' },
    start_time: { en: 'start of the period = time of purchase; "started in …" means this column', ru: 'начало периода = время покупки; «started in …» — по этой колонке' },
    end_time: { en: 'end of the period, not included: the period is [start_time, end_time)', ru: 'конец периода, не включается: период [start_time, end_time)' },
    charged_usd: { en: 'what the customer paid (gross)', ru: 'сколько заплатил клиент (gross)' },
    revenue_usd: { en: 'revenue net of refunds: 0 if the transaction was refunded (net)', ru: 'выручка за вычетом возвратов: 0, если транзакция возвращена (net)' },
    fee_rate: { en: 'channel fee: 0.15 / 0.30 on the marketplaces, 0.03 on web', ru: 'комиссия канала: 0.15 / 0.30 у маркетплейсов, 0.03 на сайте' },
    refunded_at: { en: 'when the money was returned; NULL = no refund; "refunded" = refunded_at IS NOT NULL', ru: 'когда вернули деньги; NULL = возврата не было; «refunded» = refunded_at IS NOT NULL' },
    is_test: { en: 'test purchase: exclude it from business numbers', ru: 'тестовая покупка — исключать из бизнес-чисел' },
    country: { en: "customer's country", ru: 'страна клиента' },
  },
  webhook_events: {
    _: { en: 'notifications from the sales channels (Aug–Sep 2026); one event_id can arrive twice', ru: 'уведомления от каналов продаж (авг–сен 2026); один event_id может прийти дважды' },
    event_id: { en: 'event id; a duplicate has the same event_id, only received_at differs', ru: 'id события; дубль — тот же event_id, отличается только received_at' },
    type: { en: 'purchase / renewal / expiration / refund', ru: 'purchase / renewal / expiration / refund' },
    customer_id: { en: 'the customer', ru: 'клиент' },
    product_id: { en: '→ products.id', ru: '→ products.id' },
    transaction_id: { en: '→ transactions.transaction_id', ru: '→ transactions.transaction_id' },
    occurred_at: { en: 'when the event happened in the channel', ru: 'когда событие произошло в канале' },
    received_at: { en: 'when the notification reached us', ru: 'когда уведомление дошло до нас' },
  },
  channel_payouts: {
    _: { en: 'what the partner marketplaces actually paid (Jan–Aug 2026)', ru: 'что маркетплейсы-партнёры реально заплатили (янв–авг 2026)' },
    payout_id: { en: 'payout id', ru: 'id выплаты' },
    merchant_id: { en: '→ merchants.id', ru: '→ merchants.id' },
    channel: { en: 'north_market / south_market', ru: 'north_market / south_market' },
    period_month: { en: 'first day of the sales month the payout is for', ru: 'первый день месяца продаж, за который выплата' },
    amount_usd: { en: 'payout amount', ru: 'сумма выплаты' },
    paid_at: { en: 'when the money arrived', ru: 'когда пришли деньги' },
  },
  advances: {
    _: { en: 'advances: early payouts to merchants against marketplace payouts that have not arrived yet', ru: 'авансы: выплаты продавцам раньше срока, под ещё не пришедшие выплаты маркетплейсов' },
    advance_id: { en: 'advance id', ru: 'id аванса' },
    merchant_id: { en: '→ merchants.id', ru: '→ merchants.id' },
    channel: { en: 'which marketplace payout it is against', ru: 'под выплату какого маркетплейса' },
    period_month: { en: 'which sales month it is against', ru: 'под выплату за какой месяц продаж' },
    amount_usd: { en: 'amount advanced (principal)', ru: 'сумма аванса (principal)' },
    fee_usd: { en: 'fee for the advance, 3%', ru: 'комиссия за аванс, 3%' },
    idempotency_key: { en: 'merchant:channel:month, protects from paying the same advance twice', ru: 'merchant:channel:month — ключ от повторной выдачи' },
    created_at: { en: 'when it was paid out', ru: 'когда выдан' },
  },
  ledger_entries: {
    _: { en: 'ledger of money movements for advances; rows are only added, never changed', ru: 'журнал движений денег по авансам; записи только добавляются' },
    entry_id: { en: 'entry id', ru: 'id записи' },
    merchant_id: { en: '→ merchants.id', ru: '→ merchants.id' },
    advance_id: { en: '→ advances.advance_id', ru: '→ advances.advance_id' },
    entry_type: { en: 'advance (+) / fee (+) / repayment (−)', ru: 'advance (+) / fee (+) / repayment (−)' },
    amount_usd: { en: "signed amount; the merchant's debt = SUM(amount_usd)", ru: 'сумма со знаком; долг продавца = SUM(amount_usd)' },
    created_at: { en: 'when it was recorded', ru: 'когда записано' },
  },
};

/** How the tables connect: [table, table, join condition]. */
export const tableLinks: [string, string, string][] = [
  ['products', 'merchants', 'products.merchant_id = merchants.id'],
  ['transactions', 'products', 'transactions.product_id = products.id'],
  ['webhook_events', 'products', 'webhook_events.product_id = products.id'],
  ['channel_payouts', 'merchants', 'channel_payouts.merchant_id = merchants.id'],
  ['advances', 'merchants', 'advances.merchant_id = merchants.id'],
  ['ledger_entries', 'merchants', 'ledger_entries.merchant_id = merchants.id'],
  ['ledger_entries', 'advances', 'ledger_entries.advance_id = advances.advance_id'],
];

export interface SqlContext {
  tables: { name: string; cols: string[] }[];
  links: string[];
}

/** The tables a query reads, the columns of each that it mentions (plus the key), and how they connect. */
export function sqlContext(sql: string): SqlContext {
  const tables = [...new Set([...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase()))].filter((t) => columnInfo[t]);
  return {
    tables: tables.map((t) => ({
      name: t,
      cols: Object.keys(columnInfo[t]).filter((c) => c !== '_' && (c === 'id' || new RegExp(`\\b${c}\\b`, 'i').test(sql))),
    })),
    links: tableLinks.filter(([a, b]) => tables.includes(a) && tables.includes(b)).map((l) => l[2]),
  };
}

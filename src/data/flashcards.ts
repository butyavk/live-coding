// Flashcards for the Flashcards component (/reference/flashcards/) and the
// Anki export (`npm run flashcards` → public/flashcards/*.tsv).
//
// Every answer restates what the linked page says, so numbers and definitions
// must match it (query results come from the practice dataset, see
// src/data/generated/practice.json and scripts/sql.mjs). `link` is a page
// path from scripts/pages.json, root-relative, without base and locale.
//
// Light markup in front/back text: `code`, **bold**, *italic*, and lines starting with
// "- " (bullets) or "1. " (numbered steps). Rendered by cardHtml() below.
//
// Keep this file free of imports and of non-erasable TypeScript (no enums,
// no namespaces): scripts/export-flashcards.mjs loads it directly with Node's
// type stripping.

export type FlashSection =
  | 'sql'
  | 'patterns'
  | 'traps'
  | 'python'
  | 'concepts'
  | 'interview';

export interface FlashText {
  en: string;
  ru: string;
}

export interface Flashcard {
  /** Stable id: progress in the browser and Anki GUIDs are keyed by it. */
  id: string;
  section: FlashSection;
  /** Page to read more, e.g. "/data/replication/". */
  link: string;
  front: FlashText;
  back: FlashText;
}

export const flashSections: { id: FlashSection; label: FlashText }[] = [
  { id: 'sql', label: { en: 'SQL foundations', ru: 'Основа SQL' } },
  { id: 'patterns', label: { en: 'SQL patterns', ru: 'Приёмы SQL' } },
  { id: 'traps', label: { en: 'SQL traps', ru: 'Ловушки SQL' } },
  { id: 'python', label: { en: 'Python', ru: 'Python' } },
  { id: 'concepts', label: { en: 'Database concepts', ru: 'Понятия баз данных' } },
  { id: 'interview', label: { en: 'Protocol and phrases', ru: 'Протокол и фразы' } },
];

export const flashcards: Flashcard[] = [
  // ---------------------------------------------------------------- sql
  {
    id: 'sql-half-open-month',
    section: 'sql',
    link: '/sql/filters-and-dates/',
    front: {
      en: "How do you filter one calendar month on a timestamp column?",
      ru: "Как отфильтровать один календарный месяц по колонке timestamp?",
    },
    back: {
      en: "A half-open interval: `ts >= TIMESTAMP '2026-08-01' AND ts < TIMESTAMP '2026-09-01'`. The start is included, the end is not.\nNot `BETWEEN '2026-08-01' AND '2026-08-31'`: it ends at 00:00 on 31 August and loses the rest of that day.",
      ru: "Полуоткрытый интервал: `ts >= TIMESTAMP '2026-08-01' AND ts < TIMESTAMP '2026-09-01'`. Начало включено, конец — нет.\nНе `BETWEEN '2026-08-01' AND '2026-08-31'`: он заканчивается 31 августа в 00:00 и теряет весь остальной день.",
    },
  },
  {
    id: 'sql-month-column',
    section: 'sql',
    link: '/sql/filters-and-dates/',
    front: {
      en: "How do you show the month of a timestamp as a column?",
      ru: "Как показать месяц метки времени отдельной колонкой?",
    },
    back: {
      en: "`CAST(date_trunc('month', ts) AS DATE)`: the first day of the month, as a date.\n`date_trunc` always returns a timestamp; from a `DATE` it even returns `timestamp with time zone`. `EXTRACT(MONTH FROM ts)` gives only the number 1–12 and merges the same month of different years.",
      ru: "`CAST(date_trunc('month', ts) AS DATE)`: первый день месяца в виде даты.\n`date_trunc` всегда возвращает метку времени, а от `DATE` — даже `timestamp with time zone`. `EXTRACT(MONTH FROM ts)` даёт только число 1–12 и склеивает один и тот же месяц разных лет.",
    },
  },
  {
    id: 'sql-today-literal',
    section: 'sql',
    link: '/sql/filters-and-dates/',
    front: {
      en: "The task says \"the last 30 days\". How do you write \"today\"?",
      ru: "В задаче «the last 30 days». Как записать «сегодня»?",
    },
    back: {
      en: "Ask first: interview data is usually frozen. Then write a fixed, typed literal, never `NOW()`:\n`start_time >= TIMESTAMP '2026-09-30' - INTERVAL '30 days' AND start_time < TIMESTAMP '2026-09-30'`\nWith `NOW()` the window slides into days with no data, and the answer changes every day.",
      ru: "Сначала спросить: данные на интервью обычно заморожены. Потом — фиксированный литерал с типом, никогда не `NOW()`:\n`start_time >= TIMESTAMP '2026-09-30' - INTERVAL '30 days' AND start_time < TIMESTAMP '2026-09-30'`\nС `NOW()` окно уезжает в дни без данных, и ответ меняется каждый день.",
    },
  },
  {
    id: 'sql-order-of-execution',
    section: 'sql',
    link: '/sql/grouping-and-counting/',
    front: {
      en: "In what order does SQL process the clauses of a query, and what follows from it?",
      ru: "В каком порядке SQL выполняет части запроса и что из этого следует?",
    },
    back: {
      en: "**FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT**\n- `WHERE` cannot see a `SELECT` alias; in PostgreSQL `HAVING` cannot either. Repeat the expression or use a CTE.\n- Window functions are computed in `SELECT`, so they cannot go in `WHERE`: filter them outside a CTE.\n- `ORDER BY` runs last, so it can use an alias.",
      ru: "**FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT**\n- `WHERE` не видит псевдонимы из `SELECT`; в PostgreSQL их не видит и `HAVING`. Повторите выражение или используйте CTE.\n- Оконные функции считаются в `SELECT`, поэтому в `WHERE` их нельзя: фильтруйте снаружи CTE.\n- `ORDER BY` выполняется последним, поэтому псевдоним в нём можно.",
    },
  },
  {
    id: 'sql-count-forms',
    section: 'sql',
    link: '/sql/grouping-and-counting/',
    front: {
      en: "`COUNT(*)`, `COUNT(col)`, `COUNT(DISTINCT col)`: what does each count?",
      ru: "`COUNT(*)`, `COUNT(col)`, `COUNT(DISTINCT col)`: что считает каждый?",
    },
    back: {
      en: "- `COUNT(*)`: rows.\n- `COUNT(col)`: rows where `col` is not `NULL`.\n- `COUNT(DISTINCT col)`: different values.\nTransactions without test purchases: 8032 rows, 180 with `refunded_at`, 4 channels. After a `LEFT JOIN`, count a column of the right table, or every X without a match counts as 1.",
      ru: "- `COUNT(*)` — строки.\n- `COUNT(col)` — строки, где `col` не `NULL`.\n- `COUNT(DISTINCT col)` — разные значения.\nТранзакции без тестовых покупок: 8032 строки, 180 с `refunded_at`, 4 канала продаж. После `LEFT JOIN` считайте колонку правой таблицы, иначе каждый X без пары посчитается как 1.",
    },
  },
  {
    id: 'sql-where-vs-having',
    section: 'sql',
    link: '/sql/grouping-and-counting/',
    front: {
      en: "`WHERE` or `HAVING`: which filters what?",
      ru: "`WHERE` или `HAVING`: что чем фильтруется?",
    },
    back: {
      en: "`WHERE` filters rows before grouping. `HAVING` filters groups after it, by an aggregate: `HAVING COUNT(*) > 300`.\nA condition on a plain column belongs in `WHERE`: fewer rows reach the grouping.",
      ru: "`WHERE` фильтрует строки до группировки. `HAVING` фильтрует группы после неё, по агрегату: `HAVING COUNT(*) > 300`.\nУсловие на обычную колонку — в `WHERE`: до группировки дойдёт меньше строк.",
    },
  },
  {
    id: 'sql-null-compare',
    section: 'sql',
    link: '/sql/null-logic/',
    front: {
      en: "What do `NULL = NULL` and `NULL <> 1` return? How do you test for NULL?",
      ru: "Что вернут `NULL = NULL` и `NULL <> 1`? Как проверять NULL?",
    },
    back: {
      en: "Both return `NULL`, \"unknown\", and `WHERE` keeps only rows where the condition is true.\nTest with `IS NULL` / `IS NOT NULL`. For \"not equal, counting NULL as a value\" use `IS DISTINCT FROM`.",
      ru: "Оба дают `NULL` — «неизвестно», а `WHERE` оставляет только строки, где условие истинно.\nПроверка — `IS NULL` / `IS NOT NULL`. «Не равно с учётом NULL» — `IS DISTINCT FROM`.",
    },
  },
  {
    id: 'sql-sum-empty',
    section: 'sql',
    link: '/sql/null-logic/',
    front: {
      en: "What does `SUM` return when there are no rows to add?",
      ru: "Что вернёт `SUM`, если складывать нечего?",
    },
    back: {
      en: "`NULL`, not 0. The same for `SUM(x) FILTER (WHERE …)` in a group without matches, and after a `LEFT JOIN` without a match. `COUNT` returns 0.\nFor money, wrap it: `COALESCE(SUM(amount_usd), 0)`.",
      ru: "`NULL`, а не 0. Так же у `SUM(x) FILTER (WHERE …)` в группе без совпадений и после `LEFT JOIN` без пары. `COUNT` вернёт 0.\nДля денег оберните: `COALESCE(SUM(amount_usd), 0)`.",
    },
  },
  {
    id: 'sql-filter-counters',
    section: 'sql',
    link: '/sql/conditional-aggregation/',
    front: {
      en: "How do you get several counts per group in one pass?",
      ru: "Как получить несколько счётчиков на группу за один проход?",
    },
    back: {
      en: "One `GROUP BY` with a conditional aggregate per counter: `COUNT(*) FILTER (WHERE is_trial) AS trials`.\nThe portable form is `SUM(CASE WHEN … THEN 1 ELSE 0 END)`. A sum with `FILTER` can be `NULL`, so wrap money in `COALESCE`.",
      ru: "Одна группировка и условный агрегат на каждый счётчик: `COUNT(*) FILTER (WHERE is_trial) AS trials`.\nПереносимая форма — `SUM(CASE WHEN … THEN 1 ELSE 0 END)`. Сумма с `FILTER` может быть `NULL`, поэтому деньги оборачивайте в `COALESCE`.",
    },
  },
  {
    id: 'sql-rate',
    section: 'sql',
    link: '/sql/conditional-aggregation/',
    front: {
      en: "How do you compute a rate without integer division and without division by zero?",
      ru: "Как посчитать долю без целочисленного деления и деления на ноль?",
    },
    back: {
      en: "`1.0 * a / NULLIF(b, 0)`, or `a::numeric / b`.\nIn PostgreSQL an integer divided by an integer is an integer: `7 / 2 = 3`, and `COUNT(…) / COUNT(*)` is usually 0. `ROUND` at the very end; `ROUND(x, 2)` needs a `numeric`.",
      ru: "`1.0 * a / NULLIF(b, 0)` или `a::numeric / b`.\nВ PostgreSQL целое, делённое на целое, — целое: `7 / 2 = 3`, а `COUNT(…) / COUNT(*)` обычно 0. `ROUND` — в самом конце; `ROUND(x, 2)` работает только с `numeric`.",
    },
  },
  {
    id: 'sql-left-join-zeros',
    section: 'sql',
    link: '/sql/left-join-and-zeros/',
    front: {
      en: "\"Every product, including products with zero sales\": what are the rules?",
      ru: "«Каждый продукт, включая продукты без продаж»: какие правила?",
    },
    back: {
      en: "1. Start from the table of all products: `FROM products p LEFT JOIN transactions t ON …`.\n2. Every condition on `t` goes in `ON`. In `WHERE` it drops the unmatched products, and the join becomes inner.\n3. Count a column of `t`: `COUNT(t.product_id)`; `COUNT(*)` gives 1 instead of 0.\n4. Sums get `COALESCE(…, 0)`.",
      ru: "1. Начинать с таблицы всех продуктов: `FROM products p LEFT JOIN transactions t ON …`.\n2. Все условия на `t` — в `ON`. В `WHERE` они выкинут продукты без пары, и соединение станет внутренним.\n3. Считать колонку `t`: `COUNT(t.product_id)`; `COUNT(*)` даст 1 вместо 0.\n4. Суммы — через `COALESCE(…, 0)`.",
    },
  },
  {
    id: 'sql-anti-join',
    section: 'sql',
    link: '/sql/subqueries-and-cte/',
    front: {
      en: "\"Merchants who never received an advance\": how, and why not `NOT IN`?",
      ru: "«Продавцы, которые ни разу не получали аванс»: как и почему не `NOT IN`?",
    },
    back: {
      en: "`FROM merchants m WHERE NOT EXISTS (SELECT 1 FROM advances v WHERE v.merchant_id = m.id)`, or `LEFT JOIN advances v … WHERE v.advance_id IS NULL`.\n`NOT IN` breaks on one `NULL` in the list: `1 NOT IN (2, NULL)` is `1 <> 2 AND 1 <> NULL`, which is `NULL`, so no row passes.",
      ru: "`FROM merchants m WHERE NOT EXISTS (SELECT 1 FROM advances v WHERE v.merchant_id = m.id)` или `LEFT JOIN advances v … WHERE v.advance_id IS NULL`.\n`NOT IN` ломается от одного `NULL` в списке: `1 NOT IN (2, NULL)` — это `1 <> 2 AND 1 <> NULL`, то есть `NULL`, и ни одна строка не проходит.",
    },
  },
  {
    id: 'sql-time-zone',
    section: 'sql',
    link: '/sql/filters-and-dates/',
    front: {
      en: "A `TIMESTAMP` column stores UTC. How do you get the day in New York?",
      ru: "Колонка `TIMESTAMP` хранит UTC. Как получить день по Нью-Йорку?",
    },
    back: {
      en: "Two steps: `(ts AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date`. A `timestamptz` column needs only the second step.\nOne step on a `TIMESTAMP` shifts the wrong way: 02:00 UTC on 1 September becomes 06:00, not 22:00 on 31 August.\nAsk which time zone defines \"a day\" for the people who read the report.",
      ru: "Два шага: `(ts AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date`. Колонке `timestamptz` нужен только второй.\nОдин шаг на `TIMESTAMP` сдвигает в обратную сторону: 02:00 UTC 1 сентября превращается в 06:00, а не в 22:00 31 августа.\nСпросите, в каком поясе считается «день» для тех, кто читает отчёт.",
    },
  },
  // ---------------------------------------------------------------- patterns
  {
    id: 'pat-aggregate-then-join',
    section: 'patterns',
    link: '/sql-patterns/row-multiplication/',
    front: {
      en: "Two tables each have many rows per merchant. How do you combine them?",
      ru: "У двух таблиц по много строк на продавца. Как их объединить?",
    },
    back: {
      en: "Reduce each table to one row per merchant in its own CTE, then `FROM merchants m LEFT JOIN` both CTEs, with `COALESCE`.\nJoining the raw rows pairs every row of one table with every row of the other, and every sum is multiplied. Check one merchant with a separate simple query.",
      ru: "Каждую таблицу свернуть до строки на продавца в своём CTE, потом `FROM merchants m LEFT JOIN` к обоим CTE и `COALESCE`.\nЕсли соединять сырые строки, каждая строка одной таблицы встанет в пару с каждой строкой другой, и все суммы умножатся. Проверьте одного продавца отдельным простым запросом.",
    },
  },
  {
    id: 'pat-top1-per-group',
    section: 'patterns',
    link: '/sql-patterns/top-n-per-group/',
    front: {
      en: "The best (or the latest) row in each group: what is the pattern?",
      ru: "Лучшая (или последняя) строка в каждой группе: какой приём?",
    },
    back: {
      en: "1. Reduce to one row per (group, item) if needed.\n2. In a CTE: `ROW_NUMBER() OVER (PARTITION BY group ORDER BY x DESC, id) AS rn`.\n3. Outside: `WHERE rn = 1`.\nThe `id` breaks ties, so the result is stable. A window cannot go in the `WHERE` of the same `SELECT`.",
      ru: "1. При необходимости свернуть до строки на (группа, элемент).\n2. В CTE: `ROW_NUMBER() OVER (PARTITION BY группа ORDER BY x DESC, id) AS rn`.\n3. Снаружи: `WHERE rn = 1`.\n`id` разрешает ничьи, и результат стабилен. Окно нельзя поставить в `WHERE` того же `SELECT`.",
    },
  },
  {
    id: 'pat-ties',
    section: 'patterns',
    link: '/sql-patterns/top-n-per-group/',
    front: {
      en: "Values 300, 300, 200: what do `ROW_NUMBER`, `RANK` and `DENSE_RANK` give?",
      ru: "Значения 300, 300, 200: что дадут `ROW_NUMBER`, `RANK` и `DENSE_RANK`?",
    },
    back: {
      en: "- `ROW_NUMBER`: 1, 2, 3. Always unique, so `rn = 1` keeps one of the tied rows.\n- `RANK`: 1, 1, 3. `rank = 1` keeps both.\n- `DENSE_RANK`: 1, 1, 2. No gap after a tie.\n\"Keep ties\" means `RANK`.",
      ru: "- `ROW_NUMBER`: 1, 2, 3. Всегда разные, поэтому `rn = 1` оставит только одну из равных строк.\n- `RANK`: 1, 1, 3. `rank = 1` оставит обе.\n- `DENSE_RANK`: 1, 1, 2. Без пропуска после ничьей.\n«Keep ties» — это `RANK`.",
    },
  },
  {
    id: 'pat-share',
    section: 'patterns',
    link: '/sql-patterns/running-totals-and-shares/',
    front: {
      en: "Share of the total and share within a group: how do you write each?",
      ru: "Доля от итога и доля внутри группы: как записать каждую?",
    },
    back: {
      en: "Of the total: `100.0 * x / SUM(x) OVER ()`. Within a group: `100.0 * x / SUM(x) OVER (PARTITION BY merchant_id)`.\nA window sees the rows left after `GROUP BY`. If you partition by the key that already has one row per group, every row gets 100%.",
      ru: "От итога: `100.0 * x / SUM(x) OVER ()`. Внутри группы: `100.0 * x / SUM(x) OVER (PARTITION BY merchant_id)`.\nОкно видит строки, оставшиеся после `GROUP BY`. Если делить по ключу, у которого уже одна строка на группу, у каждой строки выйдет 100 %.",
    },
  },
  {
    id: 'pat-running-total',
    section: 'patterns',
    link: '/sql-patterns/running-totals-and-shares/',
    front: {
      en: "A running total per merchant by day: the window, and the frame trap?",
      ru: "Нарастающий итог по продавцу по дням: окно и ловушка с рамкой?",
    },
    back: {
      en: "`SUM(revenue) OVER (PARTITION BY merchant_id ORDER BY day)`.\nWith `ORDER BY`, the default frame is `RANGE … CURRENT ROW`: rows with the same `day` are added together. For an exact number of rows use `ROWS`.\nA moving \"last 7 days\" with `ROWS` is right only if every day is one row: build the calendar first.",
      ru: "`SUM(revenue) OVER (PARTITION BY merchant_id ORDER BY day)`.\nС `ORDER BY` рамка по умолчанию — `RANGE … CURRENT ROW`: строки с одинаковым `day` складываются вместе. Для точного числа строк — `ROWS`.\nСкользящее «за последние 7 дней» через `ROWS` верно, только если каждый день — одна строка: сначала календарь.",
    },
  },
  {
    id: 'pat-calendar',
    section: 'patterns',
    link: '/sql-patterns/calendars-and-active-periods/',
    front: {
      en: "Every day of a period, including days with zero: how?",
      ru: "Каждый день периода, включая дни с нулём: как?",
    },
    back: {
      en: "1. A calendar: `generate_series(TIMESTAMP '2026-09-01', TIMESTAMP '2026-09-10', INTERVAL '1 day') AS g(d)`.\n2. `LEFT JOIN` the data on the day.\n3. `COALESCE(…, 0)`.\nWith `TIMESTAMP` literals the series is a plain `timestamp`, like the columns; with plain strings it is `timestamp with time zone`.",
      ru: "1. Календарь: `generate_series(TIMESTAMP '2026-09-01', TIMESTAMP '2026-09-10', INTERVAL '1 day') AS g(d)`.\n2. `LEFT JOIN` данных по дню.\n3. `COALESCE(…, 0)`.\nС литералами `TIMESTAMP` ряд — обычный `timestamp`, как у колонок; со строками — `timestamp with time zone`.",
    },
  },
  {
    id: 'pat-active-at',
    section: 'patterns',
    link: '/sql-patterns/calendars-and-active-periods/',
    front: {
      en: "When is a subscription active at moment m?",
      ru: "Когда подписка активна на момент m?",
    },
    back: {
      en: "`start_time <= m AND end_time > m AND (refunded_at IS NULL OR refunded_at > m)`\nThe period is half-open, `[start_time, end_time)`, and a refund ends the subscription. The brackets around `OR` are required: `AND` binds tighter than `OR`.",
      ru: "`start_time <= m AND end_time > m AND (refunded_at IS NULL OR refunded_at > m)`\nПериод полуоткрытый, `[start_time, end_time)`, а возврат завершает подписку. Скобки вокруг `OR` обязательны: `AND` связывает сильнее, чем `OR`.",
    },
  },
  {
    id: 'pat-dupes',
    section: 'patterns',
    link: '/sql-patterns/duplicates-and-idempotency/',
    front: {
      en: "Duplicate webhooks: how do you count deliveries, events and duplicates?",
      ru: "Дубли вебхуков: как посчитать доставки, события и дубли?",
    },
    back: {
      en: "Deliveries are `COUNT(*)`, events are `COUNT(DISTINCT event_id)`, duplicates are the difference.\n`COUNT(DISTINCT)` removes repeats only inside its own group. If a copy can fall into another group (another day by `received_at`), first number the copies with `ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at)` and keep `rn = 1`.",
      ru: "Доставки — `COUNT(*)`, события — `COUNT(DISTINCT event_id)`, дубли — разница.\n`COUNT(DISTINCT)` убирает повторы только внутри своей группы. Если копия может попасть в другую группу (другой день по `received_at`), сначала пронумеруйте копии `ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at)` и оставьте `rn = 1`.",
    },
  },
  {
    id: 'pat-on-conflict',
    section: 'patterns',
    link: '/sql-patterns/duplicates-and-idempotency/',
    front: {
      en: "How do you make sure each event is stored exactly once?",
      ru: "Как гарантировать, что каждое событие сохранится ровно один раз?",
    },
    back: {
      en: "A `PRIMARY KEY` or `UNIQUE` constraint on `event_id`, and `INSERT … ON CONFLICT (event_id) DO NOTHING`.\nTo add to a stored value instead: `ON CONFLICT (key) DO UPDATE SET v = t.v + EXCLUDED.v`.\nThe database enforces it even when two workers insert at the same time.",
      ru: "Ограничение `PRIMARY KEY` или `UNIQUE` на `event_id` и `INSERT … ON CONFLICT (event_id) DO NOTHING`.\nЧтобы прибавить к сохранённому значению: `ON CONFLICT (key) DO UPDATE SET v = t.v + EXCLUDED.v`.\nБаза гарантирует это, даже когда два воркера вставляют одновременно.",
    },
  },
  {
    id: 'pat-union-all',
    section: 'patterns',
    link: '/sql-patterns/union-and-reconciliation/',
    front: {
      en: "Sales and refunds as one stream of money per month: how?",
      ru: "Продажи и возвраты одной лентой денег по месяцам: как?",
    },
    back: {
      en: "`UNION ALL` of two branches: sales with `+amount` by `start_time`, refunds with `−amount` by `refunded_at`. Each branch has its own date column. Then one `GROUP BY` month.\nNot `UNION`: it removes equal rows, so two payments of 9.99 on the same day become one. Columns match by position.",
      ru: "`UNION ALL` двух веток: продажи с `+amount` по `start_time`, возвраты с `−amount` по `refunded_at`. У каждой ветки своя колонка даты. Потом одна группировка по месяцу.\nНе `UNION`: он убирает одинаковые строки, и два платежа по 9,99 в один день станут одним. Колонки сопоставляются по позиции.",
    },
  },
  {
    id: 'pat-reconcile',
    section: 'patterns',
    link: '/sql-patterns/union-and-reconciliation/',
    front: {
      en: "Reconcile two sources (expected and actual payouts): what is the shape of the query?",
      ru: "Сверка двух источников (ожидаемые и фактические выплаты): какая форма у запроса?",
    },
    back: {
      en: "1. Each side reduced to one row per key in its own CTE, with its filters inside.\n2. `FULL OUTER JOIN` on the key, so rows missing on either side stay.\n3. `COALESCE(a.key, b.key)` for the key columns.\n4. A `CASE` for the status: missing, unexpected, mismatch, ok.",
      ru: "1. Каждую сторону свернуть до строки на ключ в своём CTE, фильтры — внутри.\n2. `FULL OUTER JOIN` по ключу, чтобы остались строки, которых нет на одной из сторон.\n3. `COALESCE(a.key, b.key)` для колонок ключа.\n4. `CASE` для статуса: missing, unexpected, mismatch, ok.",
    },
  },
  {
    id: 'pat-flow-balance',
    section: 'patterns',
    link: '/sql-patterns/money-and-ledgers/',
    front: {
      en: "Flow or balance: which one gets a date filter?",
      ru: "Поток или остаток: у кого фильтр по датам?",
    },
    back: {
      en: "A **flow** is a sum over a period (revenue in the last 30 days): it has a date window.\nA **balance** is a state at a moment (what a merchant owes today): a sum over all time up to that moment. The ledger only adds signed entries (advance +, fee +, repayment −), so the debt is `SUM(amount_usd)` of every entry before today.\nWith a 30-day window on the ledger, `mer_03` \"owes\" −45.96; over all time it owes 116.39.",
      ru: "**Поток** — сумма за период (выручка за последние 30 дней): у него есть окно по датам.\n**Остаток** — состояние на момент (сколько продавец должен сегодня): сумма за всё время до этого момента. Журнал проводок только добавляет записи со знаком (advance +, fee +, repayment −), поэтому долг — `SUM(amount_usd)` всех записей до сегодня.\nС окном в 30 дней на журнале `mer_03` «должен» −45,96, а за всё время его долг — 116,39.",
    },
  },
  {
    id: 'pat-cohort',
    section: 'patterns',
    link: '/sql-patterns/cohorts-and-retention/',
    front: {
      en: "Retention: \"customers whose first paid purchase was in July — how many bought again in August?\" The two rules?",
      ru: "Удержание: «клиенты, чья первая платная покупка была в июле, — сколько купили снова в августе?» Два правила?",
    },
    back: {
      en: "1. The cohort comes from each customer's first paid purchase over all time: `MIN(start_time)` with no date window, then keep July.\n2. \"Also bought in August\" is `EXISTS (…)`: it checks presence and does not multiply rows like a `JOIN`.\nThe rate is `1.0 * retained / cohort_size`.",
      ru: "1. Когорта определяется первой платной покупкой клиента за всё время: `MIN(start_time)` без окна по датам, потом оставить июль.\n2. «Купил и в августе» — это `EXISTS (…)`: он проверяет наличие и не размножает строки, как `JOIN`.\nДоля — `1.0 * retained / cohort_size`.",
    },
  },
  // ---------------------------------------------------------------- traps
  {
    id: 'trap-not-in-null',
    section: 'traps',
    link: '/sql/null-logic/',
    front: {
      en: "Does `SELECT 'found' WHERE 1 NOT IN (2, NULL)` return a row?",
      ru: "Вернёт ли строку `SELECT 'found' WHERE 1 NOT IN (2, NULL)`?",
    },
    back: {
      en: "No rows. It expands to `1 <> 2 AND 1 <> NULL`, that is `TRUE AND NULL`, which is `NULL`.\nOne `NULL` in a `NOT IN` list or subquery, and the result is empty. For \"not in the list\", use `NOT EXISTS`.",
      ru: "Ни одной строки. Выражение раскрывается в `1 <> 2 AND 1 <> NULL`, то есть `TRUE AND NULL`, а это `NULL`.\nОдин `NULL` в списке или подзапросе `NOT IN` — и результат пустой. Для «нет в списке» — `NOT EXISTS`.",
    },
  },
  {
    id: 'trap-avg-else0',
    section: 'traps',
    link: '/sql/conditional-aggregation/',
    front: {
      en: "The average price of paid web checkout purchases (no trials) as `AVG(CASE WHEN channel = 'web' THEN charged_usd ELSE 0 END)`: what goes wrong?",
      ru: "Средний чек платных покупок с оплатой на сайте (без триалов) как `AVG(CASE WHEN channel = 'web' THEN charged_usd ELSE 0 END)`: что не так?",
    },
    back: {
      en: "`ELSE 0` adds a zero for every row from another channel: 1.18 instead of 13.19.\nFor `AVG`, use `FILTER (WHERE channel = 'web')` or `CASE` without `ELSE`: `NULL` does not count. For a rate, `ELSE 0` is right: `AVG(CASE WHEN … THEN 1.0 ELSE 0 END)`.",
      ru: "`ELSE 0` добавляет ноль за каждую строку из другого канала: 1,18 вместо 13,19.\nДля `AVG` — `FILTER (WHERE channel = 'web')` или `CASE` без `ELSE`: `NULL` не участвует. Для доли `ELSE 0` как раз нужен: `AVG(CASE WHEN … THEN 1.0 ELSE 0 END)`.",
    },
  },
  {
    id: 'trap-int-div',
    section: 'traps',
    link: '/sql/conditional-aggregation/',
    front: {
      en: "The share of trials as `COUNT(…) FILTER (WHERE is_trial) / COUNT(*)`: what comes out?",
      ru: "Доля триалов как `COUNT(…) FILTER (WHERE is_trial) / COUNT(*)`: что получится?",
    },
    back: {
      en: "The result is 0. Both counts are integers, and an integer divided by an integer is an integer.\nWith `100.0 * …` in front, the same expression gives 11.3 (%). Write `1.0 * a / b` or `a::numeric / b`, and `NULLIF(b, 0)` against division by zero.",
      ru: "Получится 0. Оба счётчика целые, а целое, делённое на целое, — целое.\nС `100.0 * …` впереди то же выражение даёт 11,3 (%). Пишите `1.0 * a / b` или `a::numeric / b`, а от деления на ноль — `NULLIF(b, 0)`.",
    },
  },
  {
    id: 'trap-ts-eq-date',
    section: 'traps',
    link: '/sql/filters-and-dates/',
    front: {
      en: "Purchases on 1 September with `WHERE start_time = '2026-09-01'`: how many?",
      ru: "Покупки за 1 сентября через `WHERE start_time = '2026-09-01'`: сколько?",
    },
    back: {
      en: "0: it matches midnight exactly.\n`start_time::date = '2026-09-01'` gives the right 20, but an index on `start_time` cannot be used. The range `start_time >= '2026-09-01' AND start_time < '2026-09-02'` gives 20 and can use the index.",
      ru: "0: сравнение только с полуночью.\n`start_time::date = '2026-09-01'` даёт верные 20, но индекс по `start_time` использовать нельзя. Диапазон `start_time >= '2026-09-01' AND start_time < '2026-09-02'` даёт 20 и работает с индексом.",
    },
  },
  {
    id: 'trap-literal-interval',
    section: 'traps',
    link: '/sql/filters-and-dates/',
    front: {
      en: "Does `WHERE start_time >= '2026-09-30' - INTERVAL '30 days'` run?",
      ru: "Выполнится ли `WHERE start_time >= '2026-09-30' - INTERVAL '30 days'`?",
    },
    back: {
      en: "No: `invalid input syntax for type interval: \"2026-09-30\"`. A quoted string has no type at first and takes the type of its neighbour, here an interval.\nFix: `TIMESTAMP '2026-09-30' - INTERVAL '30 days'`, which is 2026-08-31 00:00. The last 30 days then have 483 transactions. Habit: always type the date literal.",
      ru: "Нет: `invalid input syntax for type interval: \"2026-09-30\"`. Строка в кавычках сначала без типа и берёт тип у соседа — здесь интервала.\nИсправление: `TIMESTAMP '2026-09-30' - INTERVAL '30 days'`, то есть 2026-08-31 00:00. Тогда за последние 30 дней — 483 транзакции. Привычка: литерал даты всегда с типом.",
    },
  },
  {
    id: 'trap-left-where',
    section: 'traps',
    link: '/sql/left-join-and-zeros/',
    front: {
      en: "`products LEFT JOIN transactions`, then `WHERE t.country = 'JP'`, \"including zeros\". How many of the 20 products come out?",
      ru: "`products LEFT JOIN transactions`, потом `WHERE t.country = 'JP'`, «включая нули». Сколько из 20 продуктов попадёт в результат?",
    },
    back: {
      en: "19: `prd_06` disappears. For a product without a match, `t.country` is `NULL`, and `WHERE` drops the row. The `LEFT JOIN` has become an inner join.\nMove every condition on the right table into `ON`.",
      ru: "19: пропадает `prd_06`. У продукта без пары `t.country` — `NULL`, и `WHERE` выкидывает строку. `LEFT JOIN` превратился в обычное соединение.\nВсе условия на правую таблицу — в `ON`.",
    },
  },
  {
    id: 'trap-fanout',
    section: 'traps',
    link: '/sql-patterns/row-multiplication/',
    front: {
      en: "`mer_09` has 2 products and 7 advances worth 1122.81. Join merchants → products → advances and sum the advances: what do you get?",
      ru: "У `mer_09` два продукта и семь авансов на 1122,81. Соединить merchants → products → advances и сложить авансы: что получится?",
    },
    back: {
      en: "14 rows and 2245.62, exactly double. Products and advances are not related to each other, so every product is paired with every advance: 2 × 7.\nReduce each table to one row per merchant first, then join.",
      ru: "14 строк и 2245,62 — ровно вдвое больше. Продукты и авансы между собой не связаны, поэтому каждый продукт встаёт в пару с каждым авансом: 2 × 7.\nСначала свернуть каждую таблицу до строки на продавца, потом соединять.",
    },
  },
  {
    id: 'trap-and-or',
    section: 'traps',
    link: '/sql/filters-and-dates/',
    front: {
      en: "`WHERE channel = 'web' OR channel = 'north_market' AND NOT is_test`: what does it select?",
      ru: "`WHERE channel = 'web' OR channel = 'north_market' AND NOT is_test`: что выберется?",
    },
    back: {
      en: "`AND` binds tighter than `OR`, so this is \"web checkout, test purchases included\" OR \"North Market without test purchases\": 5182 rows instead of 5158.\nWhen you mix `AND` and `OR`, use brackets: `(channel = 'web' OR channel = 'north_market') AND NOT is_test`.",
      ru: "`AND` связывает сильнее, чем `OR`, поэтому это «оплата на сайте вместе с тестовыми покупками» ИЛИ «North Market без тестовых покупок»: 5182 строки вместо 5158.\nСмешиваете `AND` и `OR` — ставьте скобки: `(channel = 'web' OR channel = 'north_market') AND NOT is_test`.",
    },
  },
  {
    id: 'trap-dquote',
    section: 'traps',
    link: '/sql/postgresql-dialect/',
    front: {
      en: "What happens with `WHERE channel = \"web\"` in PostgreSQL?",
      ru: "Что будет с `WHERE channel = \"web\"` в PostgreSQL?",
    },
    back: {
      en: "An error: `column \"web\" does not exist`. Double quotes are for names of columns and tables; strings take single quotes: `channel = 'web'`.",
      ru: "Ошибка: `column \"web\" does not exist`. Двойные кавычки — для имён колонок и таблиц, строки пишут в одинарных: `channel = 'web'`.",
    },
  },
  {
    id: 'trap-alias',
    section: 'traps',
    link: '/sql/grouping-and-counting/',
    front: {
      en: "`WHERE proceeds > 50`, where `proceeds` is an alias from `SELECT`, or `HAVING n > 1000`: do they run?",
      ru: "`WHERE proceeds > 50`, где `proceeds` — псевдоним из `SELECT`, или `HAVING n > 1000`: выполнятся ли?",
    },
    back: {
      en: "Both fail with `column … does not exist`. `WHERE` runs before `SELECT`, and in PostgreSQL `HAVING` does not see `SELECT` aliases either.\nRepeat the expression (`HAVING COUNT(*) > 1000`) or compute it in a CTE and filter outside. In `ORDER BY` an alias works.",
      ru: "Оба падают с `column … does not exist`. `WHERE` выполняется раньше `SELECT`, а `HAVING` в PostgreSQL тоже не видит псевдонимы из `SELECT`.\nПовторите выражение (`HAVING COUNT(*) > 1000`) или посчитайте его в CTE и фильтруйте снаружи. В `ORDER BY` псевдоним работает.",
    },
  },
  {
    id: 'trap-window-where',
    section: 'traps',
    link: '/sql-patterns/top-n-per-group/',
    front: {
      en: "The first transaction of each customer with `WHERE ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY start_time) = 1`: does it run?",
      ru: "Первая транзакция каждого клиента через `WHERE ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY start_time) = 1`: выполнится ли?",
    },
    back: {
      en: "No: `window functions are not allowed in WHERE`. Windows are computed in `SELECT`, after `WHERE`.\nCompute `rn` in a CTE and filter `WHERE rn = 1` outside, or use `DISTINCT ON (customer_id) … ORDER BY customer_id, start_time`.",
      ru: "Нет: `window functions are not allowed in WHERE`. Окна считаются в `SELECT`, уже после `WHERE`.\nПосчитайте `rn` в CTE и фильтруйте `WHERE rn = 1` снаружи или возьмите `DISTINCT ON (customer_id) … ORDER BY customer_id, start_time`.",
    },
  },
  {
    id: 'trap-round-double',
    section: 'traps',
    link: '/sql/postgresql-dialect/',
    front: {
      en: "`ROUND(AVG(charged_usd)::float8, 2)`: does it work in PostgreSQL?",
      ru: "`ROUND(AVG(charged_usd)::float8, 2)`: работает ли в PostgreSQL?",
    },
    back: {
      en: "No: `function round(double precision, integer) does not exist`. `ROUND` with a number of decimals exists only for `numeric`.\nCast first: `ROUND(x::numeric, 2)`. Some other databases accept the float version silently.",
      ru: "Нет: `function round(double precision, integer) does not exist`. `ROUND` с числом знаков есть только для `numeric`.\nСначала приведите тип: `ROUND(x::numeric, 2)`. Некоторые другие базы молча принимают вариант с float.",
    },
  },
  {
    id: 'trap-distinct-users',
    section: 'traps',
    link: '/sql/grouping-and-counting/',
    front: {
      en: "One country, one month: 39 transactions and 35 customers. Why do the numbers differ, and which one answers \"how many customers\"?",
      ru: "Одна страна, один месяц: 39 транзакций и 35 клиентов. Почему числа разные и какое отвечает на «how many customers»?",
    },
    back: {
      en: "Some customers had several transactions that month. \"How many customers\" is `COUNT(DISTINCT customer_id)`.\nAsk first what counts as one customer: a `customer_id`, or a pair of customer and product.",
      ru: "У части клиентов за месяц было несколько транзакций. «Сколько клиентов» — это `COUNT(DISTINCT customer_id)`.\nСначала спросите, что считать одним клиентом: `customer_id` или пару «клиент + продукт».",
    },
  },
  // ---------------------------------------------------------------- python
  {
    id: 'py-group-sum',
    section: 'python',
    link: '/python/dicts-and-counting/',
    front: {
      en: "Group payments by customer and sum the amounts: the idiom?",
      ru: "Сгруппировать платежи по клиенту и сложить суммы: какая идиома?",
    },
    back: {
      en: "`totals = defaultdict(Decimal)`, then `totals[p['customer']] += p['amount']` in one loop, and `return dict(totals)`.\nA new key starts at `Decimal('0')`. Return a plain `dict`: reading a missing key of a `defaultdict` adds it. Money is `Decimal` made from strings.",
      ru: "`totals = defaultdict(Decimal)`, потом в одном цикле `totals[p['customer']] += p['amount']` и `return dict(totals)`.\nНовый ключ начинается с `Decimal('0')`. Наружу — обычный `dict`: чтение отсутствующего ключа у `defaultdict` его добавляет. Деньги — `Decimal` из строк.",
    },
  },
  {
    id: 'py-sort-keys',
    section: 'python',
    link: '/python/sorting-and-top-k/',
    front: {
      en: "Sort rows by amount descending, then by id ascending.",
      ru: "Отсортировать строки по сумме по убыванию, потом по id по возрастанию.",
    },
    back: {
      en: "`sorted(rows, key=lambda r: (-r.amount, r.id))`: a tuple key, minus for the descending number.\n`reverse=True` would reverse the id too. For a key you cannot negate (a string), sort twice: first by the second key, then by the first. `sorted` is stable, so equal items keep their order.",
      ru: "`sorted(rows, key=lambda r: (-r.amount, r.id))`: ключ-кортеж, минус для числа по убыванию.\n`reverse=True` перевернул бы и id. Если ключ нельзя взять со знаком минус (строка), сортируйте дважды: сначала по второму ключу, потом по первому. `sorted` устойчива, равные элементы сохраняют порядок.",
    },
  },
  {
    id: 'py-top-k',
    section: 'python',
    link: '/python/sorting-and-top-k/',
    front: {
      en: "Top 10 out of a million rows: do you sort everything?",
      ru: "Топ-10 из миллиона строк: сортировать всё?",
    },
    back: {
      en: "No. `heapq.nsmallest(10, rows, key=lambda r: (-r.revenue, r.customer_id))` keeps a heap of the 10 best so far: `O(n log k)` time and `O(k)` memory instead of `O(n log n)`.\nIn the database, `ORDER BY … LIMIT 10` does the same: the plan shows `top-N heapsort`. `Counter.most_common` breaks ties by first appearance, not by the alphabet.",
      ru: "Нет. `heapq.nsmallest(10, rows, key=lambda r: (-r.revenue, r.customer_id))` держит кучу из 10 лучших: `O(n log k)` по времени и `O(k)` по памяти вместо `O(n log n)`.\nВ базе то же делает `ORDER BY … LIMIT 10`: в плане видно `top-N heapsort`. `Counter.most_common` при равенстве оставляет порядок появления, а не алфавит.",
    },
  },
  {
    id: 'py-seen-set',
    section: 'python',
    link: '/python/sets-and-duplicates/',
    front: {
      en: "Duplicates, or \"have I seen it before?\": which structure, and what does it cost?",
      ru: "Дубли или «уже видели?»: какая структура и сколько стоит?",
    },
    back: {
      en: "A `set` called `seen` and one pass: membership is `O(1)` on average, so the whole pass is `O(n)`.\n`x in list` checks every element, `O(n)`, so inside a loop it becomes `O(n²)`. To keep the first copy of each event in order, add the id to `seen` when you keep the event.",
      ru: "`set` с именем `seen` и один проход: проверка — `O(1)` в среднем, весь проход — `O(n)`.\n`x in list` перебирает все элементы, `O(n)`, а в цикле это `O(n²)`. Чтобы оставить первую копию каждого события в исходном порядке, добавляйте id в `seen`, когда оставляете событие.",
    },
  },
  {
    id: 'py-latest-per-key',
    section: 'python',
    link: '/python/dicts-and-counting/',
    front: {
      en: "Events arrive out of order. How do you get the latest status per subscription?",
      ru: "События приходят не по порядку. Как получить последний статус подписки?",
    },
    back: {
      en: "A `dict` of \"best so far\": for each event, replace the stored one only if the new timestamp is later. One pass, `O(n)`.\nCompare timestamps, not the order of arrival, and agree on a rule for equal timestamps (for example, the later one in the list wins).",
      ru: "`dict` «лучшее на сейчас»: для каждого события заменять сохранённое, только если новое время позже. Один проход, `O(n)`.\nСравнивать время события, а не порядок прихода, и договориться о правиле для равного времени (например, побеждает более позднее в списке).",
    },
  },
  {
    id: 'py-decimal-round',
    section: 'python',
    link: '/python/money-and-decimal/',
    front: {
      en: "Round a `Decimal` to cents, half up and down. Why not `round()`?",
      ru: "Округлить `Decimal` до центов, half up и вниз. Почему не `round()`?",
    },
    back: {
      en: "Half up: `x.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)`, so `0.125` → `0.13`. Down: `rounding=ROUND_DOWN`, so `23.9976` → `23.99`.\n`round(x, 2)` returns a `Decimal`, but it uses banker's rounding (`0.125` → `0.12`) and cannot round down.",
      ru: "Half up: `x.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)`: `0.125` → `0.13`. Вниз: `rounding=ROUND_DOWN`: `23.9976` → `23.99`.\n`round(x, 2)` возвращает `Decimal`, но округляет по-банковски (`0.125` → `0.12`) и вниз не умеет.",
    },
  },
  {
    id: 'py-float-money',
    section: 'python',
    link: '/python/money-and-decimal/',
    front: {
      en: "Why not `float` for money?",
      ru: "Почему не `float` для денег?",
    },
    back: {
      en: "Float is binary, so `0.1 + 0.2 != 0.3`, and the error grows in sums.\nUse `Decimal` created from strings: `Decimal('0.1')`. From a float only through `str`: `Decimal(0.1)` keeps the binary error. In the database, `NUMERIC(12,2)`.",
      ru: "Float двоичный, поэтому `0.1 + 0.2 != 0.3`, и ошибка растёт в суммах.\nНужен `Decimal` из строк: `Decimal('0.1')`. Из float — только через `str`: `Decimal(0.1)` сохраняет двоичную ошибку. В базе — `NUMERIC(12,2)`.",
    },
  },
  {
    id: 'py-split-cents',
    section: 'python',
    link: '/python/money-and-decimal/',
    front: {
      en: "Split `10.00` into 3 parts that add up exactly to `10.00`.",
      ru: "Разделить `10.00` на 3 части, которые в сумме дают ровно `10.00`.",
    },
    back: {
      en: "Work in whole cents: `q, r = divmod(1000, 3)` gives `(333, 1)`. The first `r` parts get one extra cent: `3.34`, `3.33`, `3.33`.\nDividing and rounding each part separately gives parts that do not add up to the amount.",
      ru: "Считать в целых центах: `q, r = divmod(1000, 3)` даёт `(333, 1)`. Первые `r` частей получают по лишнему центу: `3.34`, `3.33`, `3.33`.\nЕсли делить и округлять каждую часть отдельно, части не сложатся в исходную сумму.",
    },
  },
  {
    id: 'py-allocate',
    section: 'python',
    link: '/python/money-and-decimal/',
    front: {
      en: "Pay debts from a payout, oldest first, partial payments allowed: the loop?",
      ru: "Погасить долги из выплаты, от самого старого, частично можно: какой цикл?",
    },
    back: {
      en: "1. A negative payout raises `ValueError`; `left = payout`.\n2. For each debt in order: `pay = min(left, due)`.\n3. Add a line only `if pay > 0`, then `left -= pay`.\n4. `break` when `left == 0`. What is left goes to the merchant.\nOne pass over the sorted debts. A `while` loop around the `for` pays the first debt twice.",
      ru: "1. Отрицательная выплата — `ValueError`; `left = payout`.\n2. Для каждого долга по порядку: `pay = min(left, due)`.\n3. Строку добавлять только `if pay > 0`, потом `left -= pay`.\n4. `break`, когда `left == 0`. Остаток уходит продавцу.\nОдин проход по отсортированным долгам. Цикл `while` вокруг `for` погасит первый долг дважды.",
    },
  },
  {
    id: 'py-intervals',
    section: 'python',
    link: '/python/intervals/',
    front: {
      en: "When do `[a, b)` and `[c, d)` overlap, and how do you merge a list of periods?",
      ru: "Когда пересекаются `[a, b)` и `[c, d)` и как слить список периодов?",
    },
    back: {
      en: "Overlap: `a < d and c < b`. Touching ends (`b == c`) do not overlap.\nMerge: sort by start, then one pass. If a period starts before (or, if touching counts, at) the end of the last merged one, extend that one to `max(end)`; otherwise start a new one. `max` keeps a nested period from shortening it. `O(n log n)` because of the sort.",
      ru: "Пересечение: `a < d and c < b`. Касание концами (`b == c`) — не пересечение.\nСлияние: сортировка по началу и один проход. Если период начинается раньше конца последнего слитого (или ровно на нём, если касание считается), продлить слитый до `max(end)`, иначе начать новый. `max` не даёт вложенному периоду укоротить слитый. `O(n log n)` из-за сортировки.",
    },
  },
  {
    id: 'py-add-months',
    section: 'python',
    link: '/python/dates-and-durations/',
    front: {
      en: "Add one month to 31 January 2026 in Python.",
      ru: "Прибавить один месяц к 31 января 2026 года на Python.",
    },
    back: {
      en: "Not with `timedelta`: months have different lengths. Compute the year and the month with `divmod(month - 1 + n, 12)`, then cap the day: `min(day, calendar.monthrange(year, month)[1])`. The result is 28 February 2026.\nFor renewals, count each from the original date: chaining gives 28 March instead of 31 March.",
      ru: "Не через `timedelta`: месяцы разной длины. Год и месяц посчитать через `divmod(month - 1 + n, 12)`, день ограничить: `min(day, calendar.monthrange(year, month)[1])`. Результат — 28 февраля 2026 года.\nПродления считать каждое от исходной даты: цепочкой выйдет 28 марта вместо 31 марта.",
    },
  },
  {
    id: 'py-rate-limiter',
    section: 'python',
    link: '/python/time-windows/',
    front: {
      en: "A rate limiter: at most `limit` requests in any `window` seconds. The structure and the rule?",
      ru: "Ограничитель частоты: не больше `limit` запросов за любые `window` секунд. Структура и правило?",
    },
    back: {
      en: "A `deque` of accepted request times. On each call:\n1. Drop from the left while `times[0] <= now - window`.\n2. If `len(times) >= limit`, return `False`: a refused request is not recorded.\n3. Otherwise append `now` and return `True`.\nPass the clock in, so tests control time without sleeping.",
      ru: "`deque` с временем принятых запросов. При каждом вызове:\n1. Слева выбрасывать, пока `times[0] <= now - window`.\n2. Если `len(times) >= limit` — вернуть `False`: отказ не записывается.\n3. Иначе добавить `now` и вернуть `True`.\nЧасы передавать снаружи, чтобы тесты управляли временем без `sleep`.",
    },
  },
  {
    id: 'py-mutable-default',
    section: 'python',
    link: '/python/classes-and-state/',
    front: {
      en: "What is wrong with `def add(item, items=[])`?",
      ru: "Что не так с `def add(item, items=[])`?",
    },
    back: {
      en: "The default list is created once, when the function is defined, and it is shared between calls: the second call sees the items of the first.\nUse `items=None` and create the list inside the function. The same trap hides in `_cache={}` and `seen=set()`.",
      ru: "Список по умолчанию создаётся один раз, при определении функции, и общий для всех вызовов: второй вызов видит элементы первого.\nПишите `items=None` и создавайте список внутри функции. Та же ловушка — в `_cache={}` и `seen=set()`.",
    },
  },
  {
    id: 'py-wraps',
    section: 'python',
    link: '/python/decorators/',
    front: {
      en: "What does `functools.wraps` do, and where does it go?",
      ru: "Что делает `functools.wraps` и куда его ставить?",
    },
    back: {
      en: "On the inner `wrapper`, because the wrapper replaces the original function. It copies the name, the docstring and the module, so logs and tools still see the real name. It also sets `__wrapped__` to the original: `help()` and `inspect.signature` follow it, and tests can call the original through it.\nA decorator with a parameter has three levels: factory → decorator → wrapper.",
      ru: "На внутренний `wrapper`, потому что обёртка подменяет исходную функцию. Он копирует имя, docstring и модуль, поэтому логи и инструменты видят настоящее имя. Ещё он записывает исходную функцию в `__wrapped__`: по нему идут `help()` и `inspect.signature`, а тесты могут вызвать исходную функцию напрямую.\nУ декоратора с параметром три уровня: фабрика → декоратор → обёртка.",
    },
  },
  {
    id: 'py-complexity',
    section: 'python',
    link: '/python/testing-and-complexity/',
    front: {
      en: "The cost of a lookup in a `dict`, a `set` and a `list`, and of sorting?",
      ru: "Сколько стоит поиск в `dict`, `set` и `list` и сортировка?",
    },
    back: {
      en: "A `dict` or `set` lookup is `O(1)` on average: they are hash tables. `x in list` is `O(n)`, so inside a loop it is `O(n²)`. Sorting is `O(n log n)`; a heap push or pop is `O(log n)`.\nSay it out loud: *\"It's O(n log n) because of the sort, and the memory is O(n).\"*",
      ru: "Поиск в `dict` или `set` — `O(1)` в среднем: это хеш-таблицы. `x in list` — `O(n)`, а в цикле — `O(n²)`. Сортировка — `O(n log n)`; добавить в кучу или достать из неё — `O(log n)`.\nВслух: *\"It's O(n log n) because of the sort, and the memory is O(n).\"*",
    },
  },
  {
    id: 'py-validate',
    section: 'python',
    link: '/python/errors-and-validation/',
    front: {
      en: "Parse an amount string into a `Decimal` safely: which errors do you handle?",
      ru: "Безопасно разобрать строку с суммой в `Decimal`: какие ошибки обработать?",
    },
    back: {
      en: "- `Decimal('abc')` raises `InvalidOperation`, which is not a `ValueError`: catch it and raise `ValueError`.\n- `Decimal('NaN')` and `Decimal('Infinity')` parse without an error: reject them with `is_finite()`.\n- Empty or negative input: raise `ValueError` with a clear message.\nThen `quantize` to cents.",
      ru: "- `Decimal('abc')` бросает `InvalidOperation`, а это не `ValueError`: поймать и бросить `ValueError`.\n- `Decimal('NaN')` и `Decimal('Infinity')` разбираются без ошибки: отсечь через `is_finite()`.\n- Пустая строка или минус: `ValueError` с понятным сообщением.\nПотом `quantize` до центов.",
    },
  },
  {
    id: 'py-sql-params',
    section: 'python',
    link: '/python/python-and-sql/',
    front: {
      en: "How do you pass an input value into SQL from Python, and where should the work happen?",
      ru: "Как передать входное значение в SQL из Python и где должна идти работа?",
    },
    back: {
      en: "Only as a parameter: `con.execute('… WHERE product_id = ?', [product_id])`, or `:product` with SQLAlchemy. Never an f-string: that is SQL injection, and parameters also handle types and quotes.\nFilter and aggregate in SQL, close to the data and its indexes; bring a small result into Python. Keep in Python only what is hard in SQL, like an allocation loop.",
      ru: "Только параметром: `con.execute('… WHERE product_id = ?', [product_id])` или `:product` в SQLAlchemy. Никогда через f-строку: это SQL-инъекция, а параметры к тому же сами разбираются с типами и кавычками.\nФильтровать и агрегировать в SQL, рядом с данными и индексами; в Python забирать маленький результат. В Python оставлять только то, что трудно выразить в SQL, например цикл распределения.",
    },
  },
  // ---------------------------------------------------------------- concepts
  {
    id: 'con-slow-query',
    section: 'concepts',
    link: '/sql-patterns/indexes-and-explain/',
    front: {
      en: "A query is slow. How do you find out why?",
      ru: "Запрос медленный. Как выяснить почему?",
    },
    back: {
      en: "Run `EXPLAIN ANALYZE` and read it from the most expensive node. Look for three things:\n- a `Seq Scan` on a big table where you expected an index;\n- estimated rows very different from actual rows: often stale statistics, so run `ANALYZE`, or columns that depend on each other (`CREATE STATISTICS`);\n- a sort or hash that spills to disk: `external merge Disk`, or `Batches` above 1.\nFix the biggest problem first, then measure again.",
      ru: "Запустить `EXPLAIN ANALYZE` и читать с самого дорогого узла. Смотреть на три вещи:\n- `Seq Scan` по большой таблице там, где ждали индекс;\n- оценка числа строк сильно расходится с фактом: часто устаревшая статистика, тогда `ANALYZE`, или колонки, зависящие друг от друга (`CREATE STATISTICS`);\n- сортировка или хеш уходят на диск: `external merge Disk` или `Batches` больше 1.\nСначала исправить самую большую проблему, потом измерить снова.",
    },
  },
  {
    id: 'con-composite-index',
    section: 'concepts',
    link: '/sql-patterns/indexes-and-explain/',
    front: {
      en: "Does the order of columns in a composite index matter?",
      ru: "Важен ли порядок колонок в составном индексе?",
    },
    back: {
      en: "Yes. An index on `(product_id, start_time)` serves `WHERE product_id = … AND start_time > …` and `WHERE product_id = …`, but not `WHERE start_time > …` alone, at least not efficiently.\nEquality columns go first, the range column last.",
      ru: "Да. Индекс по `(product_id, start_time)` помогает `WHERE product_id = … AND start_time > …` и `WHERE product_id = …`, но не `WHERE start_time > …` в одиночку, по крайней мере не эффективно.\nКолонки с равенством — первыми, колонка с диапазоном — последней.",
    },
  },
  {
    id: 'con-index-not-used',
    section: 'concepts',
    link: '/sql-patterns/indexes-and-explain/',
    front: {
      en: "There is an index on `start_time`. When will PostgreSQL not use it?",
      ru: "Есть индекс по `start_time`. Когда PostgreSQL его не использует?",
    },
    back: {
      en: "- When a function wraps the column: `start_time::date = …` or `EXTRACT(…)`. Compare the raw column with a range, or create an expression index.\n- When the query takes a large share of the table: a sequential scan is cheaper then. How large depends on the physical order: rows written in time order keep a date range cheap for longer (`pg_stats.correlation` near 1).\nCheck with `EXPLAIN ANALYZE`. And do not index every column: each index slows down writes and takes space.",
      ru: "- Когда колонку оборачивает функция: `start_time::date = …` или `EXTRACT(…)`. Сравнивайте саму колонку с диапазоном или создайте индекс по выражению.\n- Когда запрос берёт большую долю таблицы: тогда последовательное чтение дешевле. Насколько большую — зависит от физического порядка: строки, записанные по времени, дольше держат диапазон дат дешёвым (`pg_stats.correlation` около 1).\nПроверка — `EXPLAIN ANALYZE`. И не индексируйте каждую колонку: каждый индекс замедляет запись и занимает место.",
    },
  },
  {
    id: 'con-fk-index',
    section: 'concepts',
    link: '/sql-patterns/indexes-and-explain/',
    front: {
      en: "Does PostgreSQL index a foreign key column automatically?",
      ru: "Создаёт ли PostgreSQL индекс на колонку внешнего ключа автоматически?",
    },
    back: {
      en: "No. Only `PRIMARY KEY`, `UNIQUE` and `EXCLUDE` constraints get an index. Joining to `products.id` uses the primary key, but `transactions.product_id` has no index until you create one.\nFor a report on one product, an index on `(product_id, start_time)` helps.",
      ru: "Нет. Индекс получают только ограничения `PRIMARY KEY`, `UNIQUE` и `EXCLUDE`. Соединение с `products.id` использует первичный ключ, а у `transactions.product_id` индекса нет, пока его не создать.\nДля отчёта по одному продукту поможет индекс `(product_id, start_time)`.",
    },
  },
  {
    id: 'con-n-plus-1',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "What is the N+1 problem?",
      ru: "Что такое проблема N+1?",
    },
    back: {
      en: "One query for a list, then one more query for each item: 100 invoices become 101 queries.\nThe fix is a join, or one query with `WHERE id IN (…)` for all the items.",
      ru: "Один запрос за списком, потом ещё по запросу на каждый элемент: 100 счетов превращаются в 101 запрос.\nИсправление — соединение или один запрос с `WHERE id IN (…)` сразу для всех элементов.",
    },
  },
  {
    id: 'con-webhook-once',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "How do you make sure a webhook is processed only once?",
      ru: "Как гарантировать, что вебхук обработается только один раз?",
    },
    back: {
      en: "A unique constraint on `event_id` and `INSERT … ON CONFLICT (event_id) DO NOTHING`. The database guarantees it even with two workers.\nA check in application code (\"select, then insert if missing\") is not enough: two workers can both pass the check at the same time.\nThe insert and the processing commit in one transaction: if the worker crashes after the insert, both roll back, and the retry processes the event.",
      ru: "Уникальное ограничение на `event_id` и `INSERT … ON CONFLICT (event_id) DO NOTHING`. База гарантирует это даже при двух воркерах.\nПроверки в коде приложения («выбрать, вставить, если нет») мало: два воркера могут пройти её одновременно.\nВставка и обработка фиксируются в одной транзакции: если воркер упадёт после вставки, откатятся обе, и повтор обработает событие.",
    },
  },
  {
    id: 'con-transaction',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "What does a transaction give you, and what should never happen inside one?",
      ru: "Что даёт транзакция и чего нельзя делать внутри неё?",
    },
    back: {
      en: "All or nothing: either every change is saved, or none. For example, a payout and its ledger entries are written together. Other sessions do not see the changes before `COMMIT`, and after `COMMIT` they survive a crash.\nNever call an external service (a bank, a marketplace API) inside a transaction. It holds locks and a connection while it waits, and if it rolls back after a timeout, the external request may already be sent.",
      ru: "Всё или ничего: либо сохраняются все изменения, либо ни одного. Например, выплата и её записи в журнале пишутся вместе. Другие сессии не видят изменений до `COMMIT`, а после `COMMIT` они переживут сбой.\nНикогда не вызывать внешний сервис (банк, API маркетплейса) внутри транзакции. Она держит блокировки и соединение, пока ждёт, а если откатится после таймаута, внешний запрос, возможно, уже отправлен.",
    },
  },
  {
    id: 'con-isolation',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "Read Committed, Repeatable Read, Serializable: what does each mean in PostgreSQL?",
      ru: "Read Committed, Repeatable Read, Serializable: что значит каждый уровень в PostgreSQL?",
    },
    back: {
      en: "- **Read Committed** (the default): each query sees what was committed before that query started. Two `SELECT`s in one transaction can differ.\n- **Repeatable Read**: one snapshot for the whole transaction. Updating a row that another transaction changed raises an error; retry.\n- **Serializable**: the result is as if transactions ran one after another; otherwise one fails with a serialization error, and the application retries it.",
      ru: "- **Read Committed** (по умолчанию): каждый запрос видит то, что было зафиксировано до его начала. Два `SELECT` в одной транзакции могут вернуть разное.\n- **Repeatable Read**: один снимок на всю транзакцию. Попытка изменить строку, которую изменила другая транзакция, — ошибка и повтор.\n- **Serializable**: результат такой, будто транзакции шли по очереди; иначе одна падает с ошибкой сериализации, и приложение её повторяет.",
    },
  },
  {
    id: 'con-race-limit',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "A limit of 1000, a debt of 700. Two workers each check the limit and issue an advance of 250 at the same time. What happens, and how do you prevent it?",
      ru: "Лимит 1000, долг 700. Два воркера одновременно проверяют лимит и выдают по авансу на 250. Что будет и как этого не допустить?",
    },
    back: {
      en: "Both read 700, both see 950 ≤ 1000, both insert: the debt becomes 1200. Repeatable Read does not help, because they insert different rows.\nLock the merchant row first: `SELECT … FROM merchants WHERE id = … FOR UPDATE`. The second worker waits for the first to commit, then sees 950 and refuses. Or use Serializable and retry on the error.",
      ru: "Оба читают 700, оба видят 950 ≤ 1000, оба вставляют: долг становится 1200. Repeatable Read не спасает: транзакции вставляют разные строки.\nСначала заблокировать строку продавца: `SELECT … FROM merchants WHERE id = … FOR UPDATE`. Второй воркер ждёт COMMIT первого, потом видит 950 и отказывает. Или Serializable и повтор при ошибке.",
    },
  },
  {
    id: 'con-skip-locked',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "Two workers take the same job from a job table. How do you prevent it?",
      ru: "Два воркера берут одну и ту же задачу из таблицы задач. Как этого избежать?",
    },
    back: {
      en: "`SELECT … FOR UPDATE SKIP LOCKED`: each worker locks different rows and skips the ones already taken.\nAdd a unique key on the business key too, so a duplicate fails even if something else goes wrong.",
      ru: "`SELECT … FOR UPDATE SKIP LOCKED`: каждый воркер блокирует свои строки и пропускает уже занятые.\nПлюс уникальный ключ на бизнес-ключе, чтобы дубль упал, даже если что-то пойдёт не так.",
    },
  },
  {
    id: 'con-maturing-month',
    section: 'concepts',
    link: '/sql-patterns/database-concepts/',
    front: {
      en: "Can we trust the refund rate for the last month?",
      ru: "Можно ли доверять доле возвратов за последний месяц?",
    },
    back: {
      en: "Not fully. Refunds come after the purchase: in the practice data, a median of about 11 days and 21 days at most. Any month younger than that looks better than it really is.\nMark those months as incomplete, or compare months by the refund rate within the first 30 days, counting only purchases that already had 30 days.",
      ru: "Не полностью. Возвраты приходят после покупки: в учебных данных медиана — около 11 дней, максимум — 21 день. Любой месяц моложе этого окна выглядит лучше, чем на самом деле.\nПометьте такие месяцы как неполные или сравнивайте месяцы по доле возвратов за первые 30 дней, считая только покупки, у которых эти 30 дней уже прошли.",
    },
  },
  // ---------------------------------------------------------------- interview
  {
    id: 'int-protocol',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "The interview protocol in six steps?",
      ru: "Протокол интервью в шести шагах?",
    },
    back: {
      en: "**REPEAT → ASK (in one batch) → COMMENTS → PLAN → CODE → CHECK against the comments.**\nThe main idea: keep the requirements in comments, not in your head, and check the code against them before you say \"done\".",
      ru: "**REPEAT → ASK (одной пачкой) → COMMENTS → PLAN → CODE → CHECK по комментариям.**\nГлавная мысль: держать требования в комментариях, а не в голове, и сверять код с ними до слова «готово».",
    },
  },
  {
    id: 'int-timing',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "How do you split the clock on one task?",
      ru: "Как распределить время на одну задачу?",
    },
    back: {
      en: "Easy / medium / hard:\n- Restate the task and one row of the result: 1 / 1 / 1–2 min.\n- The environment once, then 3–5 task questions in one batch, answers as comments: 1–2 / about 3 / up to 5 min.\n- A plan of 2–4 steps, out loud: 1 / 1–2 / 2 min.\n- So code starts at about minute 4 / 6 / 9, and gets the target time.\n- The rest: index, complexity, production.\nThe clock: 25 min, or the target plus 10 when the target is over 15. Out of time for questions? *\"Let me start with these assumptions and adjust later.\"*",
      ru: "Лёгкая / средняя / сложная:\n- Пересказ задачи и одна строка результата: 1 / 1 / 1–2 мин.\n- Один вопрос о среде, затем 3–5 вопросов о задаче одной пачкой, ответы — комментарием: 1–2 / около 3 / до 5 мин.\n- План из 2–4 шагов вслух: 1 / 1–2 / 2 мин.\n- Значит, код начинается примерно на 4-й / 6-й / 9-й минуте, и на него — целевое время.\n- Остаток: индекс, сложность, продакшен.\nНа задачу — 25 мин или целевое время плюс 10, если оно больше 15. Время на вопросы вышло? *\"Let me start with these assumptions and adjust later.\"*",
    },
  },
  {
    id: 'int-result-row',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "What do you say in the first minute of a task?",
      ru: "Что сказать в первую минуту задачи?",
    },
    back: {
      en: "Restate the task in your own words and name one row of the result: *\"So the result has one row per merchant, with columns merchant_id and revenue. Is that right?\"*\nIf you cannot name one row, the task is not understood yet. Ask: *\"Can you show me what one row of the result should look like?\"*",
      ru: "Пересказать задачу своими словами и назвать одну строку результата: *\"So the result has one row per merchant, with columns merchant_id and revenue. Is that right?\"*\nЕсли одну строку назвать не получается, задача ещё не понята. Спросите: *\"Can you show me what one row of the result should look like?\"*",
    },
  },
  {
    id: 'int-batch-questions',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "How do you ask clarifying questions without slowing down?",
      ru: "Как задавать уточняющие вопросы, не теряя темпа?",
    },
    back: {
      en: "In one batch, each with the answer you would assume: *\"A few questions, with what I'd assume. Today is 2026-09-30, not now(). Test purchases excluded. Refunds: excluded or net? Which channels? Ties by id. Is that right?\"*\nOne more question covers data quality: *\"Anything I should know about duplicates, test data, missing values?\"*",
      ru: "Одной пачкой, и к каждому — допущение, которое кажется разумным: *\"A few questions, with what I'd assume. Today is 2026-09-30, not now(). Test purchases excluded. Refunds: excluded or net? Which channels? Ties by id. Is that right?\"*\nЕщё один вопрос закрывает качество данных: *\"Anything I should know about duplicates, test data, missing values?\"*",
    },
  },
  {
    id: 'int-column-questions',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "You see the schema for the first time. Which kinds of columns turn into questions?",
      ru: "Схема перед вами впервые. Какие колонки превращаются в вопросы?",
    },
    back: {
      en: "- A flag (`is_test`, `is_trial`): include or exclude?\n- A category (`channel`, `type`): group by it to see the values. Which of these count?\n- A time that can be `NULL` (`refunded_at`): what does NULL mean here?\n- Two similar amounts (`revenue_usd`, `charged_usd`): which one is right?\n- Several dates: which one puts a row into the period?\n- An event or payment id: can the same one arrive twice?",
      ru: "- Флаг (`is_test`, `is_trial`): включать или исключать?\n- Категория (`channel`, `type`): сгруппировать и посмотреть значения. Какие из них считаются?\n- Время, которое бывает `NULL` (`refunded_at`): что здесь значит NULL?\n- Две похожие суммы (`revenue_usd`, `charged_usd`): какая нужна?\n- Несколько дат: какая относит строку к периоду?\n- id события или платежа: может ли одно и то же прийти дважды?",
    },
  },
  {
    id: 'int-must-ask',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "The checklist of questions before you write code?",
      ru: "Обязательный список вопросов до кода?",
    },
    back: {
      en: "- **Today**: a fixed date or `now()`?\n- **Every narrowing word** (enrolled, paid, active, last 30 days): which column?\n- **Filters**: test purchases, trials, promo access, refunds, which channels.\n- **The result row**: one row per what? Include zeros and empty groups?\n- **Ties and order.**\n- **Edge cases**: negative, zero, empty.\n- **Who uses the result**: finance or a product dashboard decides refunds and rounding.\nGo through it in your head; ask three to five of these, the ones that change the result most, and write the rest as assumptions in the comments.",
      ru: "- **Сегодня**: фиксированная дата или `now()`?\n- **Каждое сужающее слово** (enrolled, paid, active, last 30 days): какая колонка?\n- **Фильтры**: тестовые покупки, триалы, промо-доступ, возвраты, какие каналы продаж.\n- **Строка результата**: одна строка на что? Включать ли нули и пустые группы?\n- **Ничьи и порядок.**\n- **Граничные случаи**: минус, ноль, пусто.\n- **Для кого результат**: финансы или продуктовый дашборд — от этого зависят возвраты и округление.\nПройдите по списку в голове; спросите три-пять пунктов, которые сильнее всего меняют результат, а остальное запишите допущениями в комментарии.",
    },
  },
  {
    id: 'int-comments',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "How do the agreed answers get into the code?",
      ru: "Как согласованные ответы попадают в код?",
    },
    back: {
      en: "As a block of comments at the top, written while you listen. The first line is **RESULT** (one row per …), then today, the filters and the definitions, and the last line is **PLAN** (2–3 steps).\nIn Python: RETURNS, the rules, the edge cases, PLAN. Say: *\"Let me write your answers down as comments, so we both see them.\"*",
      ru: "Блоком комментариев в начале, прямо во время разговора. Первая строка — **RESULT** (one row per …), потом сегодня, фильтры и определения, последняя строка — **PLAN** (2–3 шага).\nВ Python: RETURNS, правила, граничные случаи, PLAN. Вслух: *\"Let me write your answers down as comments, so we both see them.\"*",
    },
  },
  {
    id: 'int-plan-checks',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "Two questions to ask yourself while you plan a SQL query?",
      ru: "Два вопроса к себе, пока планируете SQL-запрос?",
    },
    back: {
      en: "1. Before a `JOIN`: do both sides have many rows per key? If yes, aggregate each side in a CTE first.\n2. Before a `GROUP BY` or `PARTITION BY`: within what am I choosing or counting? If the key is the same as the grouping of the previous step, the step does nothing.\nIn Python, say the rule in one sentence before the code.",
      ru: "1. Перед `JOIN`: у обеих сторон много строк на ключ? Если да — сначала агрегировать каждую сторону в CTE.\n2. Перед `GROUP BY` или `PARTITION BY`: внутри чего я выбираю или считаю? Если ключ совпадает с группировкой прошлого шага, шаг ничего не делает.\nВ Python — правило одной фразой до кода.",
    },
  },
  {
    id: 'int-check-before-done',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "The check before \"done\", in order?",
      ru: "Сверка до «готово» — по порядку?",
    },
    back: {
      en: "1. Walk through the comments: where is each one in the code? *\"Let me check the code against what we agreed.\"*\n2. The number of rows: as expected?\n3. One row by hand, or with a separate simple query.\n4. Plausibility: a maximum ten times the average, `COUNT(*)` against `COUNT(DISTINCT id)`.\n5. In Python, the edge cases from the comment: zero, partial, exactly on a boundary, more than enough, ties.",
      ru: "1. Пройти по комментариям: где каждый в коде? *\"Let me check the code against what we agreed.\"*\n2. Число строк: столько, сколько ожидалось?\n3. Одна строка руками или отдельным простым запросом.\n4. Правдоподобие: максимум в десять раз больше среднего, `COUNT(*)` против `COUNT(DISTINCT id)`.\n5. В Python — граничные случаи из комментария: ноль, частично, ровно на границе, больше чем нужно, ничьи.",
    },
  },
  {
    id: 'int-how-do-you-know',
    section: 'interview',
    link: '/start/interview-protocol/',
    front: {
      en: "The interviewer asks \"How do you know it works?\" or \"Is this what we agreed?\". What do you do?",
      ru: "Интервьюер спрашивает «How do you know it works?» или «Is this what we agreed?». Что делать?",
    },
    back: {
      en: "Run it, do not explain it: *\"Good point, let me run it.\"* Then two checks: exactly on the boundary, and one second before it.\nTo \"Is this what we agreed?\", do not say \"yes\" at once: *\"Let me re-read what we agreed\"*, then check the comments against the code.",
      ru: "Запустить, а не объяснять: *\"Good point, let me run it.\"* Потом две проверки: ровно на границе и на секунду раньше.\nНа «Is this what we agreed?» не отвечать сразу «да»: *\"Let me re-read what we agreed\"*, и сверить комментарии с кодом.",
    },
  },
  {
    id: 'int-stuck',
    section: 'interview',
    link: '/start/think-aloud/',
    front: {
      en: "You are stuck. What do you say?",
      ru: "Вы застряли. Что сказать?",
    },
    back: {
      en: "Never stay silent for more than 30 seconds; say what you are thinking about.\n- *\"I'm not sure how to … . Can I think out loud?\"*\n- *\"Let me go back to the example and check it again.\"*\n- *\"Could you point me in the right direction?\"*\n- With five minutes left: *\"I'll finish the main case first, then the edge cases.\"*",
      ru: "Не молчать дольше 30 секунд: говорить, о чём думаете.\n- *\"I'm not sure how to … . Can I think out loud?\"*\n- *\"Let me go back to the example and check it again.\"*\n- *\"Could you point me in the right direction?\"*\n- За пять минут до конца: *\"I'll finish the main case first, then the edge cases.\"*",
    },
  },
];

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

/** One line of card text → HTML: escapes it, then renders `code`, **bold** and *italic*. */
export function inlineHtml(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
}

/**
 * Card text → simple HTML. Lines starting with "- " become a bulleted list,
 * lines starting with "1. " a numbered one; other lines are paragraphs.
 * Shared by the component and the Anki export so both render the same.
 */
export function cardHtml(text: string): string {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^- (.*)$/);
    const step = line.match(/^\d+\. (.*)$/);
    const kind = bullet ? 'ul' : step ? 'ol' : null;
    if (kind) {
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inlineHtml((bullet ?? step)![1])}</li>`);
    } else {
      close();
      out.push(`<p>${inlineHtml(line)}</p>`);
    }
  }
  close();
  return out.join('');
}

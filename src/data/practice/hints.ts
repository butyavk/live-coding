// One hint per interview task: the nudge an interviewer gives when the candidate is stuck.
// It points at the next step, never at the whole solution. Shown behind a "Hint" button.
// Keep this file free of imports and of non-erasable TypeScript.
export const taskHints: Record<string, { en: string; ru: string }> = {
  q01: {
    en: "Start with the WHERE clause: which rows belong to August, and which rows never count? Once that is right, the grouping is one line.",
    ru: "Начните с WHERE: какие строки относятся к августу и какие не считаются никогда? Когда это готово, группировка — одна строка.",
  },
  q02: {
    en: "You need both names, so first walk from transactions to products to merchants. Then write \"the last 30 days\" as two comparisons with today.",
    ru: "Нужны оба имени, поэтому сначала пройдите от transactions к products и к merchants. Потом запишите «последние 30 дней» как два сравнения с сегодняшним днём.",
  },
  q03: {
    en: "Write the condition for one row first: when is a period active at exactly 1 September 00:00? Then add what makes it paid and what a refund changes.",
    ru: "Сначала напишите условие для одной строки: когда период активен ровно в 1 сентября 00:00? Потом добавьте, что делает его платным и что меняет возврат.",
  },
  q04: {
    en: "You already have the count for one moment from Q03. Generate the 30 days first, attach that count to each day, and think about a day with no rows at all.",
    ru: "Счёт для одного момента у вас уже есть из Q03. Сначала получите 30 дней, привяжите этот счёт к каждому дню и подумайте о дне, где строк нет вовсе.",
  },
  q05: {
    en: "Which table lists every merchant, even one with no sales? Start from it, build the nine months with generate_series, and only then attach the revenue.",
    ru: "Какая таблица содержит каждого продавца, даже без продаж? Начните с неё, постройте девять месяцев через generate_series и только потом присоедините выручку.",
  },
  q06: {
    en: "You need to compare each row with the previous row of the same customer and product. Which window function gives you the previous end_time?",
    ru: "Каждую строку нужно сравнить с предыдущей строкой того же клиента и продукта. Какая оконная функция даст предыдущий end_time?",
  },
  q07: {
    en: "First find each customer's latest row per product, for example with ROW_NUMBER. The status is then a CASE on that one row.",
    ru: "Сначала найдите последнюю строку каждого клиента по продукту, например через ROW_NUMBER. Статус — это CASE по одной этой строке.",
  },
  q08: {
    en: "A trial and its conversion are different rows of one chain. Put the Q2 trials in one CTE and the converted chains in another, then choose the join that keeps trials without a conversion.",
    ru: "Триал и его конверсия — разные строки одной цепочки. Положите триалы Q2 в один CTE, а сконвертированные цепочки — в другой, и выберите соединение, которое сохранит триалы без конверсии.",
  },
  q09: {
    en: "Before any window function, build a grid of merchants and days, so that every day has a row. The running total and the 7-day average are then two windows with different frames.",
    ru: "До всяких оконных функций постройте сетку «продавцы × дни», чтобы у каждого дня была строка. Нарастающий итог и среднее за 7 дней — это два окна с разными рамками.",
  },
  q10: {
    en: "Collapse each subscription to one row first: group the paid rows by original_transaction_id and take the first start and the last end. Then active on 1 August and churned are simple conditions.",
    ru: "Сначала сверните каждую подписку в одну строку: сгруппируйте платные строки по original_transaction_id и возьмите первое начало и последний конец. Тогда «активна на 1 августа» и «ушла» — простые условия.",
  },
  q11: {
    en: "Before you count anything, mark which copy of each event_id arrived first by received_at. Then events and duplicates come out of the same GROUP BY.",
    ru: "Прежде чем считать, пометьте, какая копия каждого event_id пришла первой по received_at. Тогда события и дубли получатся из одного и того же GROUP BY.",
  },
  q12: {
    en: "Build the two sides separately: expected proceeds per merchant, channel and month, and the payouts grouped the same way. Then think about which join keeps a row that exists on only one side.",
    ru: "Постройте две стороны отдельно: ожидаемую выручку по продавцу, каналу и месяцу и выплаты, сгруппированные так же. Потом подумайте, какое соединение сохранит строку, которая есть только с одной стороны.",
  },
  q13: {
    en: "Start with one row per advance and one boolean column per rule. When the flags look right, turn them into one output row per broken rule.",
    ru: "Начните со строки на аванс и логической колонки на каждое правило. Когда флаги выглядят верно, превратите их в одну строку результата на каждое нарушение.",
  },
  q14: {
    en: "Sum the ledger per advance first, so you know which advances are still open. Then roll those rows up per merchant.",
    ru: "Сначала сложите журнал проводок по каждому авансу, чтобы знать, какие авансы ещё открыты. Потом сверните эти строки по продавцу.",
  },
  q15: {
    en: "A refund counts on its own day, and that day may have no sales at all. So put sales and refunds into one list of rows, each with its own day, before you group. Then ask what the second run should do with a row that is already in the table.",
    ru: "Возврат считается в свой день, и в этот день продаж может не быть вовсе. Поэтому сложите продажи и возвраты в один список строк, у каждой свой день, и только потом группируйте. Затем подумайте, что второй запуск должен сделать со строкой, которая уже есть в таблице.",
  },
  d01: {
    en: "Run it as it is and pick one merchant. Count that merchant's August transactions with a plain query, compare the two numbers, and read each clause against the \"should show\" text.",
    ru: "Запустите запрос как есть и возьмите одного продавца. Посчитайте его августовские транзакции простым запросом, сравните два числа и сверьте каждую часть запроса с описанием того, что отчёт должен показывать.",
  },
  p01: {
    en: "Store the time together with the value, so you can tell when an entry has expired. Which structure lets you move a key to the end and drop the oldest one in O(1)?",
    ru: "Храните время вместе со значением, чтобы понимать, когда запись просрочена. Какая структура позволяет перенести ключ в конец и удалить самый старый за O(1)?",
  },
  p02: {
    en: "You need two pieces of state: the event ids you have processed, and the last applied event per customer. Decide the order of the checks before you write them.",
    ru: "Нужны две части состояния: обработанные id событий и последнее применённое событие по каждому клиенту. Решите, в каком порядке идут проверки, до того как их писать.",
  },
  p03: {
    en: "What becomes easier if the periods are sorted by start? Then walk through them once: what do you need to remember to decide whether the next period joins the current one?",
    ru: "Что становится проще, если периоды отсортированы по началу? Потом пройдите по ним один раз: что нужно помнить, чтобы решить, присоединяется ли следующий период к текущему?",
  },
  p04: {
    en: "Do not add a month to the previous date. Compute each renewal from the original start, then clamp the day to the last day of the target month.",
    ru: "Не прибавляйте месяц к предыдущей дате. Считайте каждое продление от исходной даты и прижимайте день к последнему дню нужного месяца.",
  },
  p05: {
    en: "One subscription changes the daily count on only two days. Which two? If you write down just those changes, how do you get the count for every day of the range?",
    ru: "Одна подписка меняет дневной счёт только в два дня. В какие? Если записать только эти изменения, как получить счёт для каждого дня диапазона?",
  },
  p06: {
    en: "Write the three limits as three separate lines and take the smallest. Then decide the rounding: which direction for the amount, and which for the fee?",
    ru: "Запишите три ограничения тремя отдельными строками и возьмите наименьшее. Потом решите с округлением: в какую сторону для суммы и в какую для комиссии?",
  },
  p07: {
    en: "What goes wrong if a guess takes an invoice that another payment refers to? Decide the order of the two rules before you write them. Then: which invoices can match one payment at all, and how do you find them without scanning every invoice?",
    ru: "Что пойдёт не так, если догадка заберёт счёт, на который ссылается другой платёж? Решите, в каком порядке идут два правила, до того как их писать. Потом: какие счета вообще могут подойти одному платежу и как найти их, не перебирая все счета?",
  },
  p08: {
    en: "For each key, keep the times of the requests you allowed, oldest first. On every call, drop the times that have left the window before you count.",
    ru: "Для каждого ключа храните времена разрешённых запросов, от старых к новым. При каждом вызове сначала выкиньте времена, которые вышли из окна, а потом считайте.",
  },
  p09: {
    en: "Treat the two errors differently: after a TransientError a retry is safe, after a TimeoutError you first need to know whether the money left. Use one key for all attempts.",
    ru: "Обрабатывайте две ошибки по-разному: после TransientError повтор безопасен, а после TimeoutError сначала нужно узнать, ушли ли деньги. Один ключ на все попытки.",
  },
  p10: {
    en: "Write a small function that decides whether one transaction counts at as_of, and try it alone. Then turn each price into a monthly value and round only at the end.",
    ru: "Напишите маленькую функцию, которая решает, считается ли одна транзакция на as_of, и проверьте её отдельно. Потом переведите каждую цену в месячную и округляйте только в конце.",
  },
  p11: {
    en: "Let SQL return only what you need: the distinct days with a paid sale, sorted. The streak is then one loop over a list of dates.",
    ru: "Пусть SQL вернёт только нужное: различные дни с платной продажей, по порядку. Тогда серия — это один цикл по списку дат.",
  },
  p12: {
    en: "Write one small function that takes the fields of one row and returns either a Payout or an error code, and try it on single rows first. Then the loop: what must you remember from earlier lines, and at what moment may a payout id join that memory?",
    ru: "Напишите одну маленькую функцию, которая получает поля одной строки и возвращает либо Payout, либо код ошибки, и сначала проверьте её на отдельных строках. Потом цикл: что нужно помнить о предыдущих строках и в какой момент id выплаты может попасть в эту память?",
  },
  p13: {
    en: "Split the work into two loops: one over the pages, one over the attempts of a single page. What stays the same when you retry a page, what starts again on the next page, and what must you remember to notice that the server sends you in circles?",
    ru: "Разбейте работу на два цикла: по страницам и по попыткам одной страницы. Что остаётся прежним при повторе страницы, что начинается заново на следующей и что нужно помнить, чтобы заметить, что сервер водит вас по кругу?",
  },
  p14: {
    en: "Read the docstring as a list of promises and give each one a test. For each test, ask: if the code broke this promise in the most likely way, would my expected value change? If not, pick other numbers or other ids.",
    ru: "Прочитайте docstring как список обещаний и дайте каждому свой тест. Для каждого теста спросите себя: если код нарушит это обещание самым вероятным способом, изменится ли ожидаемое значение? Если нет, возьмите другие числа или другие id.",
  },
  d02: {
    en: "Start with the failure that says the result does not change for a different list: what could survive from one call to the next? Fix that first, and the other failures will make more sense.",
    ru: "Начните с падения, где результат не меняется при другом списке: что может дожить от одного вызова до следующего? Исправьте это первым, и остальные падения станут понятнее.",
  },
  d03: {
    en: "Start with the test that calls deliver_all twice without seen: what in the signature lives longer than one call? Then follow one event that fails, line by line.",
    ru: "Начните с теста, который дважды вызывает deliver_all без seen: что в сигнатуре живёт дольше одного вызова? Потом пройдите строка за строкой путь одного события, которое падает.",
  },
};

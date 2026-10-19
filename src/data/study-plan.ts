// Study plan for the StudyPlan component (/start/study-plan/): three timelines, each a checklist
// of steps that link to pages of this site. `path` is relative to the site root, without base
// and locale ("sql/joins/"). A step whose page already appears in an earlier step is an activity
// of its own (for example a timed mock interview on the protocol page).
//
// Study time is not typed by hand: src/components/lib/skill-map-data.ts estimates every page from
// its text and exercises, and planTime() there adds what a timeline asks for on top (core drills
// only, second attempts, mock interviews, flashcards). The plan and the map print that estimate.

export type Timeline = 'short' | 'medium' | 'long';

interface L {
  en: string;
  ru: string;
}

/** What a timeline asks for on a page when it is less than the whole page. */
export interface StepScope {
  /** The checklist line for this timeline, instead of `task`. `{min}` becomes the estimated minutes. */
  task?: L;
  /** The tasks to solve on a task page; the page's other tasks are optional. */
  tasks?: string[];
  /** Only the TL;DR, the "In the interview" box and the spoken questions (Talk) of the page. */
  brief?: boolean;
}

export interface StudyStep {
  id: string;
  path: string;
  task: L;
  timelines: Timeline[];
  /** Timelines that show the step as optional: it can be ticked, but is not counted in the plan's steps or hours. */
  optional?: Timeline[];
  scope?: Partial<Record<Timeline, StepScope>>;
}

export interface StudyPhase {
  id: string;
  title: L;
  /** What to aim for in this phase, per timeline. */
  aim: Record<Timeline, L>;
  /** Timelines that solve every drill and task of this phase a second time (counted in the hours). */
  again?: Timeline[];
  steps: StudyStep[];
}

export interface TimelineInfo {
  id: Timeline;
  name: L;
  duration: L;
  /** `duration` in calendar days (low, high): the hours per day and the skill map's paths use it. */
  days: [number, number];
  summary: L;
  /** Only the drills and traps marked "core" on each page are part of the plan; the rest are optional. */
  coreOnly?: boolean;
  /** Full mock interviews in this timeline (low, high), counted in the hours. */
  mocks: [number, number];
}

/** The plan a reader sees before choosing one (the plan and the map share the choice). */
export const DEFAULT_TIMELINE: Timeline = 'medium';

export const timelines: TimelineInfo[] = [
  {
    id: 'short',
    name: { en: 'Short', ru: 'Короткий' },
    duration: { en: '1 week', ru: '1 неделя' },
    days: [5, 7],
    coreOnly: true,
    mocks: [1, 1],
    summary: { en: 'The protocol, the core drills of each page and eight full tasks on a timer.', ru: 'Протокол, основные упражнения каждой страницы и восемь полных задач на время.' },
  },
  {
    id: 'medium',
    name: { en: 'Medium', ru: 'Средний' },
    duration: { en: '2–3 weeks', ru: '2–3 недели' },
    days: [14, 21],
    mocks: [2, 2],
    summary: { en: 'The core plus the patterns that separate a pass from a strong pass. Most tasks, out loud.', ru: 'Основа и приёмы, которые отличают «прошёл» от «прошёл уверенно». Большинство задач, вслух.' },
  },
  {
    id: 'long',
    name: { en: 'Long', ru: 'Длинный' },
    duration: { en: '4–6 weeks', ru: '4–6 недель' },
    days: [28, 42],
    mocks: [4, 6],
    summary: { en: 'Every topic and every task, each task solved twice: once to learn, once on a timer a week later.', ru: 'Все темы и все задачи, каждая задача дважды: первый раз — разобраться, второй — на время через неделю.' },
  },
];

/** Steps of a timeline that count (optional ones are shown but not counted). */
export const countsIn = (s: StudyStep, tl: Timeline) => s.timelines.includes(tl) && !s.optional?.includes(tl);
/** Steps a timeline shows: counted ones and optional ones. */
export const shownIn = (s: StudyStep, tl: Timeline) => s.timelines.includes(tl) || !!s.optional?.includes(tl);

const ALL: Timeline[] = ['short', 'medium', 'long'];
const ML: Timeline[] = ['medium', 'long'];
const LONG: Timeline[] = ['long'];
/** The optional backend track of the short plan: a rate limiter and a cache are common backend questions. */
const BACKEND: Timeline[] = ['short'];

export const studyPhases: StudyPhase[] = [
  {
    id: 'orient',
    title: { en: 'Get oriented', ru: 'Сориентироваться' },
    aim: {
      short: { en: 'Know what the interviewer checks and how to split the time of a task.', ru: 'Понять, что проверяет интервьюер и как распределить время задачи.' },
      medium: { en: 'Learn the protocol and say its phrases out loud until they come without thinking.', ru: 'Выучить протокол и проговаривать его фразы вслух, пока они не пойдут сами.' },
      long: { en: 'Learn the protocol and use it on every exercise of this site, not only on the tasks.', ru: 'Выучить протокол и применять его к каждому упражнению сайта, а не только к задачам.' },
    },
    steps: [
      { id: 'intro', path: 'start/introduction/', timelines: ALL, task: { en: 'Read what a live-coding interview tests and how this site works', ru: 'Узнать, что проверяет лайвкодинг-интервью и как устроен этот сайт' } },
      { id: 'plan', path: 'start/study-plan/', timelines: ALL, task: { en: 'Pick a plan and read how to practise', ru: 'Выбрать план и прочитать, как тренироваться' } },
      { id: 'protocol', path: 'start/interview-protocol/', timelines: ALL, task: { en: 'Learn the protocol: restate, ask, plan, code in small steps, check', ru: 'Освоить протокол: пересказ, вопросы, план, код маленькими шагами, проверка' } },
      { id: 'aloud', path: 'start/think-aloud/', timelines: ALL, task: { en: 'Pick two or three phrases for each stage and say them out loud', ru: 'Выбрать по две-три фразы на каждый этап и проговорить их вслух' } },
      { id: 'dataset', path: 'start/dataset/', timelines: ALL, task: { en: 'Get to know the practice dataset and run a first query', ru: 'Познакомиться с учебными данными и выполнить первый запрос' } },
      { id: 'questions', path: 'start/questions-to-ask/', timelines: ALL, task: { en: 'Prepare two questions for the end of the interview', ru: 'Подготовить два вопроса на конец интервью' } },
    ],
  },
  {
    id: 'sql',
    title: { en: 'SQL foundations', ru: 'Основа SQL' },
    aim: {
      short: { en: 'Solve the core drills on each page without looking at the answer, and guess every core trap before running it.', ru: 'Решить основные упражнения на каждой странице, не глядя в ответ, и угадать каждую основную ловушку до запуска.' },
      medium: { en: 'Solve every drill, then say out loud which trap it protects against.', ru: 'Решить каждое упражнение и сказать вслух, от какой ловушки оно защищает.' },
      long: { en: 'Solve every drill twice: today, and from an empty editor a few days later.', ru: 'Решить каждое упражнение дважды: сегодня и с пустого окна через несколько дней.' },
    },
    again: LONG,
    steps: [
      { id: 'filters', path: 'sql/filters-and-dates/', timelines: ALL, task: { en: 'Filters and dates: half-open intervals, months, "today"', ru: 'Фильтры и даты: полуоткрытые интервалы, месяцы, «сегодня»' } },
      { id: 'grouping', path: 'sql/grouping-and-counting/', timelines: ALL, task: { en: 'GROUP BY, HAVING and the three kinds of COUNT', ru: 'GROUP BY, HAVING и три вида COUNT' } },
      { id: 'null', path: 'sql/null-logic/', timelines: ALL, task: { en: 'NULL: comparisons, NOT IN, empty sums', ru: 'NULL: сравнения, NOT IN, пустые суммы' } },
      { id: 'conditional', path: 'sql/conditional-aggregation/', timelines: ALL, task: { en: 'CASE, FILTER and rates without integer division', ru: 'CASE, FILTER и доли без целочисленного деления' } },
      { id: 'joins', path: 'sql/joins/', timelines: ALL, task: { en: 'JOIN: keys, how tables connect, one row per what', ru: 'JOIN: ключи, связи таблиц, одна строка на что' } },
      { id: 'left', path: 'sql/left-join-and-zeros/', timelines: ALL, task: { en: 'LEFT JOIN: "every X, even with zero"', ru: 'LEFT JOIN: «каждый X, даже с нулём»' } },
      { id: 'cte', path: 'sql/subqueries-and-cte/', timelines: ALL, task: { en: 'CTE, EXISTS and NOT EXISTS', ru: 'CTE, EXISTS и NOT EXISTS' } },
      { id: 'dialect', path: 'sql/postgresql-dialect/', timelines: ML, task: { en: 'PostgreSQL specifics that break queries from other databases', ru: 'Особенности PostgreSQL, на которых ломаются запросы из других баз' } },
    ],
  },
  {
    id: 'patterns',
    title: { en: 'SQL patterns', ru: 'Приёмы SQL' },
    aim: {
      short: { en: 'Know the five patterns that most tasks are built from, recognise them in a task text, and have one sentence ready about indexes.', ru: 'Знать пять приёмов, из которых собрано большинство задач, узнавать их в тексте задачи и иметь наготове фразу про индексы.' },
      medium: { en: 'Know every pattern and the follow-up question it usually brings.', ru: 'Знать каждый приём и вопрос, который обычно идёт следом.' },
      long: { en: 'Know every pattern, and solve each drill a second way (a window instead of a subquery, and back).', ru: 'Знать каждый приём и решить каждое упражнение вторым способом (окно вместо подзапроса и наоборот).' },
    },
    again: LONG,
    steps: [
      { id: 'fanout', path: 'sql-patterns/row-multiplication/', timelines: ALL, task: { en: 'Row multiplication: aggregate before you join', ru: 'Размножение строк: свернуть до ключа, потом соединять' } },
      { id: 'topn', path: 'sql-patterns/top-n-per-group/', timelines: ALL, task: { en: 'Best and latest per group: ROW_NUMBER, RANK, DISTINCT ON', ru: 'Лучший и последний в группе: ROW_NUMBER, RANK, DISTINCT ON' } },
      { id: 'running', path: 'sql-patterns/running-totals-and-shares/', timelines: ALL, task: { en: 'Shares, running totals and LAG', ru: 'Доли, нарастающий итог и LAG' } },
      { id: 'calendars', path: 'sql-patterns/calendars-and-active-periods/', timelines: ALL, task: { en: 'Every day, even empty; active at a moment', ru: 'Каждый день, даже пустой; активна на момент' } },
      { id: 'dupes', path: 'sql-patterns/duplicates-and-idempotency/', timelines: ALL, task: { en: 'Duplicates, constraints and ON CONFLICT', ru: 'Дубли, ограничения и ON CONFLICT' } },
      { id: 'union', path: 'sql-patterns/union-and-reconciliation/', timelines: ML, task: { en: 'UNION ALL and FULL OUTER JOIN: two feeds, two sources', ru: 'UNION ALL и FULL OUTER JOIN: две ленты, два источника' } },
      { id: 'ledgers', path: 'sql-patterns/money-and-ledgers/', timelines: ML, task: { en: 'Money: flows, balances and ledgers', ru: 'Деньги: потоки, остатки и журнал проводок' } },
      {
        id: 'indexes',
        path: 'sql-patterns/indexes-and-explain/',
        timelines: ALL,
        task: { en: 'Indexes and EXPLAIN: which index helps this query', ru: 'Индексы и EXPLAIN: какой индекс поможет запросу' },
        scope: { short: { brief: true, task: { en: 'Indexes and EXPLAIN: the TL;DR, the "In the interview" box and the spoken questions ({min} min)', ru: 'Индексы и EXPLAIN: блоки «Коротко» и «На интервью» и вопросы вслух ({min} мин)' } } },
      },
      { id: 'concepts', path: 'sql-patterns/database-concepts/', timelines: ML, task: { en: 'Database concepts out loud: transactions, isolation, constraints', ru: 'Понятия баз данных вслух: транзакции, изоляция, ограничения' } },
      { id: 'cohorts', path: 'sql-patterns/cohorts-and-retention/', timelines: LONG, task: { en: 'Cohorts and retention', ru: 'Когорты и удержание' } },
    ],
  },
  {
    id: 'python',
    title: { en: 'Python for live coding', ru: 'Python для лайвкодинга' },
    aim: {
      short: { en: 'Have the everyday tools in your fingers: dict, set, sorted, Decimal, datetime, a small class.', ru: 'Держать в пальцах повседневные инструменты: dict, set, sorted, Decimal, datetime, небольшой класс.' },
      medium: { en: 'Add decorators, error handling and time windows, and name the complexity of every solution.', ru: 'Добавить декораторы, обработку ошибок и окна по времени и называть сложность каждого решения.' },
      long: { en: 'Everything, plus generators and the follow-up questions about testing and production.', ru: 'Всё, плюс генераторы и вопросы о тестах и продакшене, которые задают после кода.' },
    },
    steps: [
      { id: 'dicts', path: 'python/dicts-and-counting/', timelines: ALL, task: { en: 'dict, defaultdict and Counter: group and count', ru: 'dict, defaultdict и Counter: сгруппировать и посчитать' } },
      { id: 'sets', path: 'python/sets-and-duplicates/', timelines: ALL, task: { en: 'Sets: duplicates and comparing two collections', ru: 'Множества: дубли и сравнение двух наборов' } },
      { id: 'sorting', path: 'python/sorting-and-top-k/', timelines: ALL, task: { en: 'Sorting by several keys and top-k', ru: 'Сортировка по нескольким ключам и топ-k' } },
      { id: 'money', path: 'python/money-and-decimal/', timelines: ALL, task: { en: 'Money with Decimal: rounding, splitting, allocating', ru: 'Деньги в Decimal: округление, деление, распределение' } },
      { id: 'dates', path: 'python/dates-and-durations/', timelines: ALL, task: { en: 'Dates, months and ISO strings', ru: 'Даты, месяцы и ISO-строки' } },
      { id: 'intervals', path: 'python/intervals/', timelines: ALL, task: { en: 'Intervals: overlap and merge', ru: 'Интервалы: пересечение и слияние' } },
      { id: 'classes', path: 'python/classes-and-state/', timelines: ALL, task: { en: 'A small class with state and an injected clock', ru: 'Небольшой класс с состоянием и часами снаружи' } },
      { id: 'testing', path: 'python/testing-and-complexity/', timelines: ALL, task: { en: 'Complexity and testing: what to say after the code works', ru: 'Сложность и тесты: что сказать, когда код заработал' } },
      { id: 'decorators', path: 'python/decorators/', timelines: ML, optional: BACKEND, task: { en: 'Decorators and closures', ru: 'Декораторы и замыкания' } },
      { id: 'errors', path: 'python/errors-and-validation/', timelines: ML, task: { en: 'Errors and input validation', ru: 'Ошибки и проверка ввода' } },
      { id: 'windows', path: 'python/time-windows/', timelines: ML, optional: BACKEND, task: { en: 'Time windows with deque', ru: 'Окна по времени через deque' } },
      { id: 'pysql', path: 'python/python-and-sql/', timelines: ML, task: { en: 'Python and the database: parameters, where the work goes', ru: 'Python и база: параметры, где делать работу' } },
      { id: 'iteration', path: 'python/iteration-and-generators/', timelines: LONG, task: { en: 'Iteration, batches and generators', ru: 'Итерация, пачки и генераторы' } },
    ],
  },
  {
    id: 'practice',
    title: { en: 'Interview tasks', ru: 'Задачи как на интервью' },
    aim: {
      short: {
        en: 'Solve the eight tasks below on a timer, out loud, from an empty editor; the other tasks on these pages are optional. Read the walkthrough only after Check passes. Interviewing for a backend role? The optional steps add a rate limiter and a TTL cache.',
        ru: 'Решить восемь задач ниже на время, вслух, с пустого окна; остальные задачи на этих страницах — по желанию. Разбор читать только после зелёной проверки. Идёте на бэкенд-роль? Шаги «по желанию» добавят ограничитель частоты и кэш с TTL.',
      },
      medium: { en: 'Solve most tasks on a timer. Redo the one that went worst three days later.', ru: 'Решить большинство задач на время. Через три дня перерешать ту, что прошла хуже всего.' },
      long: { en: 'Solve every task twice, and answer the follow-up question after each one.', ru: 'Решить каждую задачу дважды и ответить на вопрос-продолжение после каждой.' },
    },
    again: LONG,
    steps: [
      {
        id: 't-revenue',
        path: 'sql-tasks/revenue-reports/',
        timelines: ALL,
        task: { en: 'SQL: revenue reports', ru: 'SQL: отчёты о выручке' },
        scope: { short: { tasks: ['q01', 'q05'], task: { en: 'SQL: revenue reports, Q01 and Q05', ru: 'SQL: отчёты о выручке, Q01 и Q05' } } },
      },
      {
        id: 't-over-time',
        path: 'sql-tasks/subscriptions-over-time/',
        timelines: ALL,
        task: { en: 'SQL: subscriptions over time', ru: 'SQL: подписки во времени' },
        scope: { short: { tasks: ['q03', 'q07'], task: { en: 'SQL: subscriptions over time, Q03 and Q07', ru: 'SQL: подписки во времени, Q03 и Q07' } } },
      },
      { id: 't-debug-sql', path: 'sql-tasks/debug-a-report/', timelines: ALL, task: { en: 'SQL: debug a broken report', ru: 'SQL: найти ошибки в отчёте' } },
      { id: 't-funnels', path: 'sql-tasks/funnels-and-churn/', timelines: ML, task: { en: 'SQL: trial conversion, churn and running revenue', ru: 'SQL: конверсия триалов, отток и нарастающая выручка' } },
      { id: 't-money-sql', path: 'sql-tasks/money-and-reconciliation/', timelines: ML, task: { en: 'SQL: duplicates, reconciliation, balances and a daily table', ru: 'SQL: дубли, сверка, остатки и дневная таблица' } },
      {
        id: 't-events',
        path: 'python-tasks/events-and-time/',
        timelines: ALL,
        task: { en: 'Python: events, periods and dates', ru: 'Python: события, периоды и даты' },
        scope: { short: { tasks: ['p02', 'p03'], task: { en: 'Python: events and periods, P02 and P03', ru: 'Python: события и периоды, P02 и P03' } } },
      },
      {
        id: 't-debug-py',
        path: 'python-tasks/debugging/',
        timelines: ALL,
        task: { en: 'Python: debug two broken modules', ru: 'Python: найти ошибки в двух модулях' },
        scope: { short: { tasks: ['d02'], task: { en: 'Python: debug a broken module, D02', ru: 'Python: найти ошибки в модуле, D02' } } },
      },
      { id: 't-money-py', path: 'python-tasks/money/', timelines: ML, task: { en: 'Python: advances, matching, safe payouts, a partner file and writing tests', ru: 'Python: авансы, сопоставление, безопасные выплаты, файл партнёра и написание тестов' } },
      { id: 't-cache', path: 'python-tasks/caching-and-rate-limits/', timelines: ML, optional: BACKEND, task: { en: 'Python: a TTL cache, a rate limiter and a paginated API client', ru: 'Python: кэш с TTL, ограничитель частоты и клиент API с постраничной выдачей' } },
      { id: 't-sqlpy', path: 'python-tasks/sql-and-python/', timelines: ML, task: { en: 'SQL and Python in one task', ru: 'SQL и Python в одной задаче' } },
    ],
  },
  {
    id: 'final',
    title: { en: 'Before the interview', ru: 'Перед интервью' },
    aim: {
      short: { en: 'Write the recipes on one sheet by hand and do one full mock.', ru: 'Переписать приёмы от руки на один лист и провести один полный мок.' },
      medium: { en: 'Recipes by hand, flashcards daily, two mocks with a friend.', ru: 'Приёмы от руки, карточки каждый день, два мока с другом.' },
      long: { en: 'Recipes by hand, flashcards daily, a mock every week.', ru: 'Приёмы от руки, карточки каждый день, мок каждую неделю.' },
    },
    steps: [
      { id: 'recipes', path: 'reference/recipes/', timelines: ALL, task: { en: 'Copy the one-line recipes onto a sheet of paper by hand', ru: 'Переписать приёмы одной строкой на листок от руки' } },
      { id: 'mistakes', path: 'reference/common-mistakes/', timelines: ALL, task: { en: 'Go through the common mistakes the day before', ru: 'Пройтись по частым ошибкам накануне' } },
      { id: 'flashcards', path: 'reference/flashcards/', timelines: ALL, task: { en: 'Review the flashcards (a few minutes a day)', ru: 'Повторять карточки (несколько минут в день)' } },
      { id: 'cheatsheets', path: 'reference/sql-cheatsheet/', timelines: ML, task: { en: 'Read the SQL cheat sheet and find each item in the PostgreSQL docs', ru: 'Прочитать шпаргалку SQL и найти каждый пункт в документации PostgreSQL' } },
      { id: 'pycheat', path: 'reference/python-cheatsheet/', timelines: ML, task: { en: 'Read the Python cheat sheet and open each module in the Python docs', ru: 'Прочитать шпаргалку Python и открыть каждый модуль в документации' } },
      { id: 'glossary', path: 'reference/glossary/', timelines: ML, task: { en: 'Read the glossary and explain each term in one sentence', ru: 'Прочитать словарь и объяснить каждый термин одной фразой' } },
      { id: 'mock', path: 'start/mock-interview/', timelines: ALL, task: { en: 'Mock interview: a random SQL and a random Python task, on the mock clock, out loud, with a friend or a recorder', ru: 'Мок-интервью: случайная задача SQL и случайная Python, по часам мока, вслух — с другом или на диктофон' } },
    ],
  },
];

/**
 * Progress key of every step: `page:<path>` for the first step that links to a page (shared with
 * the skill map's "learned" mark), `act:<id>` for a later step on the same page (an activity).
 */
export function stepKeys(): Map<string, string> {
  const seen = new Set<string>();
  const keyOf = new Map<string, string>();
  for (const ph of studyPhases)
    for (const st of ph.steps) {
      keyOf.set(st.id, seen.has(st.path) ? `act:${st.id}` : `page:${st.path}`);
      seen.add(st.path);
    }
  return keyOf;
}

/** Number of counted steps in a timeline: the plan and the map both print this number. */
export const planSize = (tl: Timeline) => studyPhases.reduce((n, p) => n + p.steps.filter((s) => countsIn(s, tl)).length, 0);

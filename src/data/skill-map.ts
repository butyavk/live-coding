// Skill map: every topic page as a node in a prerequisite graph.
// Used by the map page (/start/skill-map/), the "on the map" block at the end of each
// topic page and the study plan. Titles and descriptions come from the pages themselves;
// this file only holds structure.
//
// Rules (checked by validateSkillMap() at build time):
// - every `path` and every entry of `needs` is a node; the graph has no cycles;
// - `needs` lists only DIRECT prerequisites — "do this first, or the page will not make sense";
// - plan closure: a node that is in a study-plan timeline only needs nodes that are in that
//   timeline too, so following the short plan never sends you to a page outside it; a step that
//   is optional in a timeline needs only nodes that the timeline shows (counted or optional).
// - plan order: in every timeline, a page's prerequisites come before it in the study plan, so the
//   map's "Next up" (the plan's order) always starts with a topic that is ready.

import { countsIn, shownIn, studyPhases, type Timeline } from './study-plan';

interface L {
  en: string;
  ru: string;
}

export type StageId = 'orient' | 'sql' | 'patterns' | 'python' | 'practice' | 'final';

export interface Stage {
  id: StageId;
  title: L;
  /** What you can do once the stage is done. */
  outcome: L;
  tracks: string[];
  /** First column of the overview this stage may use (keeps practice on the right). */
  floor: number;
}

export interface Track {
  id: string;
  title: L;
}

export interface SkillNode {
  /** Page path without base or locale, with trailing slash: "sql/joins/". */
  path: string;
  /** Prerequisites (direct only). */
  needs: string[];
  /** Short label for the map when the page title is long. */
  label?: L;
}

export const tracks: Track[] = [
  { id: 'start', title: { en: 'Start here', ru: 'С чего начать' } },
  { id: 'reference', title: { en: 'Reference', ru: 'Справочник' } },
  { id: 'sql', title: { en: 'SQL foundations', ru: 'Основа SQL' } },
  { id: 'sql-patterns', title: { en: 'SQL patterns', ru: 'Приёмы SQL' } },
  { id: 'python', title: { en: 'Python for live coding', ru: 'Python для лайвкодинга' } },
  { id: 'sql-tasks', title: { en: 'Practice: SQL tasks', ru: 'Практика: задачи SQL' } },
  { id: 'python-tasks', title: { en: 'Practice: Python tasks', ru: 'Практика: задачи Python' } },
];

export const stages: Stage[] = [
  {
    id: 'orient',
    title: { en: 'Get oriented', ru: 'Сориентироваться' },
    outcome: {
      en: 'You know what the interviewer checks, how to spend the time, and what is in the practice data.',
      ru: 'Вы знаете, что проверяет интервьюер, как распределить время и что лежит в учебных данных.',
    },
    tracks: ['start'],
    floor: 0,
  },
  {
    id: 'sql',
    title: { en: 'SQL foundations', ru: 'Основа SQL' },
    outcome: {
      en: 'You can filter, group and join without losing rows, zeros or the last day of the month.',
      ru: 'Вы фильтруете, группируете и соединяете, не теряя строк, нулей и последнего дня месяца.',
    },
    tracks: ['sql'],
    floor: 1,
  },
  {
    id: 'patterns',
    title: { en: 'SQL patterns', ru: 'Приёмы SQL' },
    outcome: {
      en: 'You recognise the pattern behind a task: best per group, every day, two sources, duplicates, a balance.',
      ru: 'Вы узнаёте приём за текстом задачи: лучший в группе, каждый день, два источника, дубли, остаток.',
    },
    tracks: ['sql-patterns'],
    floor: 2,
  },
  {
    id: 'python',
    title: { en: 'Python for live coding', ru: 'Python для лайвкодинга' },
    outcome: {
      en: 'You write a correct function in small steps with the standard library, and name its complexity.',
      ru: 'Вы пишете верную функцию маленькими шагами на стандартной библиотеке и называете её сложность.',
    },
    tracks: ['python'],
    floor: 1,
  },
  {
    id: 'practice',
    title: { en: 'Interview tasks', ru: 'Задачи как на интервью' },
    outcome: {
      en: 'You solve a task out loud within its clock: questions first, a check before "done", a follow-up answered.',
      ru: 'Вы решаете задачу вслух и укладываетесь в её время: сначала вопросы, проверка до «готово», ответ на продолжение.',
    },
    tracks: ['sql-tasks', 'python-tasks'],
    floor: 5,
  },
  {
    id: 'final',
    title: { en: 'Before the interview', ru: 'Перед интервью' },
    outcome: {
      en: 'The recipes fit on one sheet, you know the common mistakes, and the facts come back in seconds.',
      ru: 'Приёмы помещаются на одном листе, частые ошибки известны, а факты вспоминаются за секунды.',
    },
    tracks: ['reference'],
    floor: 5,
  },
];

const n = (path: string, needs: string[] = [], label?: L): SkillNode => ({ path, needs, label });

/** In display order inside each track (the sidebar order). */
export const skillNodes: SkillNode[] = [
  // Start here
  n('start/introduction/'),
  n('start/study-plan/', ['start/introduction/']),
  n('start/interview-protocol/', ['start/introduction/'], { en: 'Interview protocol', ru: 'Протокол интервью' }),
  n('start/think-aloud/', ['start/interview-protocol/'], { en: 'Think aloud', ru: 'Думать вслух' }),
  n('start/mock-interview/', ['start/think-aloud/'], { en: 'Mock interview', ru: 'Мок-интервью' }),
  n('start/dataset/', ['start/introduction/'], { en: 'Practice dataset', ru: 'Учебные данные' }),
  n('start/questions-to-ask/', ['start/interview-protocol/'], { en: 'Questions to ask', ru: 'Вопросы интервьюеру' }),
  // Reference
  n('reference/recipes/', ['sql/left-join-and-zeros/', 'python/dicts-and-counting/'], { en: 'Recipes', ru: 'Приёмы на листок' }),
  n('reference/sql-cheatsheet/', ['sql/filters-and-dates/'], { en: 'SQL cheat sheet', ru: 'Шпаргалка SQL' }),
  n('reference/python-cheatsheet/', ['python/dicts-and-counting/'], { en: 'Python cheat sheet', ru: 'Шпаргалка Python' }),
  n('reference/common-mistakes/', ['sql-patterns/row-multiplication/', 'start/interview-protocol/'], { en: 'Common mistakes', ru: 'Частые ошибки' }),
  n('reference/glossary/', ['start/dataset/'], { en: 'Glossary', ru: 'Словарь' }),
  n('reference/flashcards/', ['start/introduction/'], { en: 'Flashcards', ru: 'Карточки' }),
  // SQL foundations
  n('sql/filters-and-dates/', ['start/dataset/'], { en: 'Filters and dates', ru: 'Фильтры и даты' }),
  n('sql/grouping-and-counting/', ['sql/filters-and-dates/'], { en: 'Grouping and counting', ru: 'Группировка и подсчёт' }),
  n('sql/null-logic/', ['sql/filters-and-dates/'], { en: 'NULL', ru: 'NULL' }),
  n('sql/conditional-aggregation/', ['sql/grouping-and-counting/', 'sql/null-logic/'], { en: 'CASE, FILTER, rates', ru: 'CASE, FILTER, доли' }),
  n('sql/joins/', ['sql/grouping-and-counting/'], { en: 'JOIN', ru: 'JOIN' }),
  n('sql/left-join-and-zeros/', ['sql/joins/', 'sql/null-logic/'], { en: 'LEFT JOIN and zeros', ru: 'LEFT JOIN и нули' }),
  n('sql/subqueries-and-cte/', ['sql/joins/'], { en: 'CTE and EXISTS', ru: 'CTE и EXISTS' }),
  n('sql/postgresql-dialect/', ['sql/filters-and-dates/'], { en: 'PostgreSQL dialect', ru: 'Диалект PostgreSQL' }),
  // SQL patterns
  n('sql-patterns/row-multiplication/', ['sql/left-join-and-zeros/', 'sql/subqueries-and-cte/'], { en: 'Row multiplication', ru: 'Размножение строк' }),
  n('sql-patterns/top-n-per-group/', ['sql/subqueries-and-cte/', 'sql/grouping-and-counting/'], { en: 'Top N per group', ru: 'Лучший в группе' }),
  n('sql-patterns/running-totals-and-shares/', ['sql-patterns/top-n-per-group/'], { en: 'Shares and running totals', ru: 'Доли и нарастающий итог' }),
  n('sql-patterns/calendars-and-active-periods/', ['sql/left-join-and-zeros/', 'sql/filters-and-dates/'], { en: 'Calendars and active periods', ru: 'Календари и активные периоды' }),
  n('sql-patterns/duplicates-and-idempotency/', ['sql/grouping-and-counting/', 'sql-patterns/top-n-per-group/'], { en: 'Duplicates and idempotency', ru: 'Дубли и идемпотентность' }),
  n('sql-patterns/union-and-reconciliation/', ['sql/left-join-and-zeros/', 'sql/subqueries-and-cte/'], { en: 'UNION ALL and reconciliation', ru: 'UNION ALL и сверка' }),
  n('sql-patterns/money-and-ledgers/', ['sql/conditional-aggregation/', 'sql-patterns/row-multiplication/'], { en: 'Money and ledgers', ru: 'Деньги и журнал проводок' }),
  n('sql-patterns/indexes-and-explain/', ['sql/filters-and-dates/'], { en: 'Indexes and EXPLAIN', ru: 'Индексы и EXPLAIN' }),
  n('sql-patterns/database-concepts/', ['sql-patterns/duplicates-and-idempotency/', 'sql-patterns/indexes-and-explain/'], { en: 'Database concepts', ru: 'Понятия баз данных' }),
  n('sql-patterns/cohorts-and-retention/', ['sql/subqueries-and-cte/', 'sql/filters-and-dates/'], { en: 'Cohorts and retention', ru: 'Когорты и удержание' }),
  // Python
  n('python/dicts-and-counting/', ['start/introduction/'], { en: 'dict and Counter', ru: 'dict и Counter' }),
  n('python/sets-and-duplicates/', ['python/dicts-and-counting/'], { en: 'Sets and duplicates', ru: 'Множества и дубли' }),
  n('python/sorting-and-top-k/', ['python/dicts-and-counting/'], { en: 'Sorting and top-k', ru: 'Сортировка и топ-k' }),
  n('python/money-and-decimal/', ['python/dicts-and-counting/'], { en: 'Money and Decimal', ru: 'Деньги и Decimal' }),
  n('python/dates-and-durations/', ['start/introduction/'], { en: 'Dates and durations', ru: 'Даты и периоды' }),
  n('python/intervals/', ['python/dates-and-durations/', 'python/sorting-and-top-k/'], { en: 'Intervals', ru: 'Интервалы' }),
  n('python/classes-and-state/', ['python/dicts-and-counting/'], { en: 'Classes and state', ru: 'Классы и состояние' }),
  n('python/testing-and-complexity/', ['python/sets-and-duplicates/', 'python/sorting-and-top-k/'], { en: 'Testing and complexity', ru: 'Тесты и сложность' }),
  n('python/decorators/', ['python/classes-and-state/'], { en: 'Decorators', ru: 'Декораторы' }),
  n('python/errors-and-validation/', ['python/money-and-decimal/'], { en: 'Errors and validation', ru: 'Ошибки и проверка ввода' }),
  n('python/time-windows/', ['python/classes-and-state/'], { en: 'Time windows', ru: 'Окна по времени' }),
  n('python/python-and-sql/', ['python/dicts-and-counting/', 'sql/filters-and-dates/'], { en: 'Python and SQL', ru: 'Python и SQL' }),
  n('python/iteration-and-generators/', ['python/dicts-and-counting/'], { en: 'Iteration and generators', ru: 'Итерация и генераторы' }),
  // Practice: SQL tasks
  n('sql-tasks/revenue-reports/', ['start/interview-protocol/', 'sql/left-join-and-zeros/', 'sql/conditional-aggregation/'], { en: 'Revenue reports', ru: 'Отчёты о выручке' }),
  n('sql-tasks/subscriptions-over-time/', ['sql-patterns/calendars-and-active-periods/', 'sql-patterns/top-n-per-group/', 'sql-patterns/running-totals-and-shares/'], { en: 'Subscriptions over time', ru: 'Подписки во времени' }),
  n('sql-tasks/debug-a-report/', ['sql-tasks/revenue-reports/', 'sql-patterns/row-multiplication/'], { en: 'Debug a report', ru: 'Отладка отчёта' }),
  n('sql-tasks/funnels-and-churn/', ['sql/subqueries-and-cte/', 'sql/conditional-aggregation/', 'sql-patterns/running-totals-and-shares/'], { en: 'Conversion and churn', ru: 'Конверсия и отток' }),
  n('sql-tasks/money-and-reconciliation/', ['sql-patterns/union-and-reconciliation/', 'sql-patterns/money-and-ledgers/', 'sql-patterns/duplicates-and-idempotency/'], { en: 'Money and reconciliation', ru: 'Деньги и сверка' }),
  // Practice: Python tasks
  n('python-tasks/events-and-time/', ['start/interview-protocol/', 'python/sets-and-duplicates/', 'python/intervals/'], { en: 'Events and time', ru: 'События и время' }),
  n('python-tasks/debugging/', ['python/testing-and-complexity/', 'python/money-and-decimal/'], { en: 'Debugging', ru: 'Отладка' }),
  n('python-tasks/money/', ['python/money-and-decimal/', 'python/errors-and-validation/', 'python/sets-and-duplicates/'], { en: 'Money tasks', ru: 'Задачи про деньги' }),
  n('python-tasks/caching-and-rate-limits/', ['python/decorators/', 'python/time-windows/'], { en: 'Caching and rate limits', ru: 'Кэш и лимиты' }),
  n('python-tasks/sql-and-python/', ['python/python-and-sql/', 'sql-tasks/revenue-reports/'], { en: 'SQL + Python', ru: 'SQL + Python' }),
];

export const trackOf = (path: string) => path.split('/')[0];

/** The map page itself. */
export const MAP_PATH = 'start/skill-map/';

const ALL_TL: Timeline[] = ['short', 'medium', 'long'];

/** Timelines whose study plan counts the page (empty: not a plan step, shown in every plan). */
export function plansFor(path: string): Timeline[] {
  const set = new Set<Timeline>();
  for (const ph of studyPhases) for (const s of ph.steps) if (s.path === path) ALL_TL.filter((t) => countsIn(s, t)).forEach((t) => set.add(t));
  return [...set];
}

/** Timelines that show the page as an optional step (and do not count it). */
export function optionalFor(path: string): Timeline[] {
  const own = plansFor(path);
  const set = new Set<Timeline>();
  for (const ph of studyPhases) for (const s of ph.steps) if (s.path === path) ALL_TL.filter((t) => shownIn(s, t) && !own.includes(t)).forEach((t) => set.add(t));
  return [...set];
}

/** Position of the page in the study plan (first step that links to it), for "next up" ordering. */
export function planOrder(path: string): number {
  let i = 0;
  for (const ph of studyPhases)
    for (const s of ph.steps) {
      if (s.path === path) return i;
      i++;
    }
  return 1000 + skillNodes.findIndex((x) => x.path === path);
}

/** Throws with a readable message if the graph breaks one of the rules above. */
export function validateSkillMap(pagePaths: string[]): void {
  const errors: string[] = [];
  const byPath = new Map(skillNodes.map((x) => [x.path, x]));
  if (byPath.size !== skillNodes.length) errors.push('duplicate node paths');
  const trackIds = new Set(tracks.map((t) => t.id));
  const staged = stages.flatMap((s) => s.tracks);
  for (const t of trackIds) if (staged.filter((x) => x === t).length !== 1) errors.push(`track ${t} must be in exactly one stage`);
  for (const x of skillNodes) {
    if (!trackIds.has(trackOf(x.path))) errors.push(`${x.path}: unknown track`);
    if (!pagePaths.includes(x.path)) errors.push(`${x.path}: no such page`);
    for (const d of x.needs) {
      if (!byPath.has(d)) errors.push(`${x.path}: needs unknown ${d}`);
      if (d === x.path) errors.push(`${x.path}: needs itself`);
    }
    const own = plansFor(x.path);
    for (const d of x.needs) {
      const theirs = plansFor(d);
      if (!theirs.length) continue;
      for (const t of own) if (!theirs.includes(t)) errors.push(`${x.path} is in the ${t} plan but needs ${d}, which is not`);
      for (const t of optionalFor(x.path))
        if (!theirs.includes(t) && !optionalFor(d).includes(t)) errors.push(`${x.path} is optional in the ${t} plan but needs ${d}, which that plan does not show`);
    }
  }
  // Every topic page must be on the map (About pages and the map itself are not topics).
  for (const p of pagePaths)
    if (p && !p.startsWith('about/') && p !== MAP_PATH && !byPath.has(p)) errors.push(`page ${p} is missing from the map`);
  // Every study-plan step must be on the map, and a page's prerequisites come before it in every plan.
  for (const ph of studyPhases) for (const s of ph.steps) if (!byPath.has(s.path)) errors.push(`study plan step ${s.id}: ${s.path} is not on the map`);
  for (const t of ALL_TL) {
    const order = studyPhases.flatMap((ph) => ph.steps.filter((s) => shownIn(s, t)).map((s) => s.path));
    order.forEach((p, i) => {
      for (const d of byPath.get(p)?.needs ?? []) {
        const j = order.indexOf(d);
        if (j > i) errors.push(`the ${t} plan has ${p} before its prerequisite ${d}`);
      }
    });
  }
  // Cycle check (DFS).
  const state = new Map<string, number>();
  const visit = (p: string, trail: string[]): void => {
    if (state.get(p) === 2) return;
    if (state.get(p) === 1) {
      errors.push(`cycle: ${[...trail, p].join(' → ')}`);
      return;
    }
    state.set(p, 1);
    for (const d of byPath.get(p)?.needs ?? []) visit(d, [...trail, p]);
    state.set(p, 2);
  };
  for (const x of skillNodes) visit(x.path, []);
  if (errors.length) throw new Error(`Skill map is invalid:\n- ${errors.join('\n- ')}`);
}

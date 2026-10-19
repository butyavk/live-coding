// Build-time access to the practice data: the hand-written files in src/data/practice/ and the
// results that scripts/build-exercises.mjs recorded in src/data/generated/practice.json.
// A wrong id fails the build with a readable message.
import practice from '~/data/generated/practice.json';
import { sqlDrills, type SqlDrill } from '~/data/practice/sql-drills';
import { pyDrills, type PyDrill } from '~/data/practice/py-drills';
import { traps, type Trap } from '~/data/practice/traps';
import { sqlTasks, type SqlTask } from '~/data/practice/sql-tasks';
import { pyTasks, type PyTask } from '~/data/practice/py-tasks';
import { columnInfo } from '~/data/practice/columns';

// Optional files written by the content writers: hints for the tasks and Russian translations of
// the English task texts. Globbed, so the site builds before they exist (and the build script
// checks that every key in them is a real id).
const optional = import.meta.glob(['/src/data/practice/hints.ts', '/src/data/practice/translations-ru.ts'], { eager: true }) as Record<string, any>;
const hintsMod = optional['/src/data/practice/hints.ts'];
const ruMod = optional['/src/data/practice/translations-ru.ts'];

export interface RuText {
  q?: string;
  task?: string;
  bug?: string;
  should?: string;
  brief?: string[];
  example?: string;
  ask?: { q: string; a: string }[];
}
const taskHints: Record<string, { en: string; ru: string }> = hintsMod?.taskHints ?? {};
const ruText: Record<string, RuText> = ruMod?.ruText ?? {};

/** The hint for a task in the page language, or ''. */
export const hintFor = (id: string, locale: 'en' | 'ru'): string => taskHints[id]?.[locale] ?? '';
/** The Russian translation of an exercise's English texts (Russian pages only). */
export const ruFor = (id: string, locale: 'en' | 'ru'): RuText | null => (locale === 'ru' ? (ruText[id] ?? null) : null);

export type Locale = 'en' | 'ru';
export const localeOf = (astro: { locals: any }): Locale => (astro.locals?.starlightRoute?.locale === 'ru' ? 'ru' : 'en');

type Json = any;
const P = practice as Json;

export interface Expected {
  cols: string[];
  types: number[];
  rows: (string | number | null)[][];
  sample: unknown[][];
  n: number;
  ordered?: boolean;
  /** Fingerprint of the reference result on the hidden edge-case data (no rows). */
  edge?: EdgeExpected | null;
}
export interface EdgeExpected {
  n: number;
  cols: number;
  hash: string;
}

export interface Ctx {
  tables: { name: string; cols: string[]; sample?: { cols: string[]; rows: unknown[][] } }[];
  links: string[];
}

const fail = (what: string, id: string, where: string): never => {
  throw new Error(`Practice: no ${what} with id "${id}" (${where}). Ids are listed in src/data/practice/ and src/data/generated/practice.json (npm run exercises).`);
};

export function getDrill(id: string) {
  const sql = sqlDrills.find((d) => d.id === id);
  if (sql) {
    const gen = P.sqlDrills[id] ?? fail('SQL drill result', id, 'practice.json');
    return { kind: 'sql' as const, data: sql as SqlDrill, expected: gen.expected as Expected | null, edge: (gen.edge ?? null) as EdgeExpected | null, orderBy: (gen.orderBy ?? '') as string, ctx: gen.ctx as Ctx };
  }
  const py = pyDrills.find((d) => d.id === id);
  if (py) {
    const gen = P.pyDrills[id] ?? fail('Python drill result', id, 'practice.json');
    return { kind: 'py' as const, data: py as PyDrill, harness: gen.harness as string, expectedOut: gen.expected as [string, string][] };
  }
  return fail('drill', id, 'sql-drills.ts or py-drills.ts');
}

export function getTrap(id: string) {
  const t = traps.find((d) => d.id === id) ?? fail('trap', id, 'traps.ts');
  const gen = P.traps[id] ?? fail('trap result', id, 'practice.json');
  return { data: t as Trap, actual: gen.actual as { cols?: string[]; rows?: unknown[][]; error?: string; hint?: string | null; position?: number | null }, fixed: gen.fixed as (Expected & { orderBy?: string; edge?: EdgeExpected | null }) | null, ctx: gen.ctx as Ctx };
}

export function getTask(id: string) {
  const sqlMeta = sqlTasks.find((t) => t.id === id);
  if (sqlMeta) {
    const gen = P.sqlTasks[id] ?? fail('SQL task', id, 'practice.json');
    return { kind: 'sql' as const, meta: sqlMeta as SqlTask, task: gen as SqlTaskGen };
  }
  const pyMeta = pyTasks.find((t) => t.id === id);
  if (pyMeta) {
    const gen = P.pyTasks[id] ?? fail('Python task', id, 'practice.json');
    return { kind: 'py' as const, meta: pyMeta as PyTask, task: gen as PyTaskGen };
  }
  return fail('task', id, 'sql-tasks.ts or py-tasks.ts');
}

export interface SqlTaskGen {
  id: string;
  debug: boolean;
  title: string;
  level: string;
  target: number;
  task: string;
  ask: { q: string; a: string }[];
  cols: string;
  order: string;
  bug: string;
  should: string;
  template: string;
  solution: string;
  expected: Expected;
  example: { cols: string[]; rows: unknown[][] } | null;
}

export interface PyTaskGen {
  mod: string;
  debug: boolean;
  title: string;
  level: string;
  target: number;
  body: string;
  ask: { q: string; a: string }[];
  hint: string;
  template: string;
  solution: string;
  tests: string[];
  db: boolean;
}

export const tableAbout = (table: string, locale: Locale) => columnInfo[table]?._?.[locale] ?? '';
export const columnAbout = (table: string, col: string, locale: Locale) => columnInfo[table]?.[col]?.[locale] ?? '';

/** Table and column names for SQL autocomplete in the editor. */
export const schemaForEditor = (): Record<string, string[]> =>
  Object.fromEntries(Object.entries(columnInfo).map(([t, cols]) => [t, Object.keys(cols).filter((c) => c !== '_')]));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain task text to HTML: escapes everything, then `code` and **bold**. */
export function inline(text: string): string {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** A cell as text for a server-rendered table. */
export function cellText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

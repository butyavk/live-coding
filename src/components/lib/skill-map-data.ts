// Build-time view of the skill map for one locale: structure from src/data/skill-map.ts,
// titles, descriptions and study time from the pages themselves. Also the study time of each
// study-plan timeline and the exercises each plan step asks for, so the plan and the map print
// the same estimate and count the same exercises.
import { getCollection } from 'astro:content';
import { skillNodes, plansFor, optionalFor, planOrder, trackOf, validateSkillMap } from '~/data/skill-map';
import { studyPhases, timelines, countsIn, shownIn, type StepScope, type Timeline } from '~/data/study-plan';
import { sqlDrills } from '~/data/practice/sql-drills';
import { pyDrills } from '~/data/practice/py-drills';
import { traps } from '~/data/practice/traps';
import type { Locale } from './format';
import practice from '~/data/generated/practice.json';

export interface MapNode {
  /** Path without base/locale: "sql/joins/". */
  p: string;
  /** Label for the map. */
  t: string;
  /** Full page title. */
  title: string;
  d: string;
  tr: string;
  needs: string[];
  /** Direct dependents. */
  deps: string[];
  /** Timelines that count the page. */
  plans: string[];
  /** Timelines that show the page as optional. */
  opt: string[];
  ord: number;
  /** Study time (reading plus exercises), minutes. */
  min: number;
  /** Study time of what each timeline asks for on this page (the whole page outside the timeline). */
  mins: Record<Timeline, number>;
  /** Exercises Check can mark solved that each timeline asks for on this page (ids). */
  ex: Record<Timeline, string[]>;
}

// Time to study a page: read it carefully and do its exercises. Prose at about 150 words a
// minute (125 in Russian, whose words are longer), code at about 15 lines a minute, and a
// fixed time per exercise: a drill 6 minutes, a trap 3, a spoken question 2, a playground 3,
// an interview task its target time × 1.5 (first attempt, check, walkthrough).
const PER = { Drill: 6, Trap: 3, Talk: 2, Playground: 3 } as const;
/** A second attempt (the long plan): a drill from an empty editor again, a task at its target time. */
const AGAIN = { Drill: 6, Task: 1 } as const;
/** Self-review after a mock interview (the checklist on the mock page). */
const MOCK_REVIEW = 10;

type P = { target?: number | null };
const tasks = { ...practice.sqlTasks, ...practice.pyTasks } as Record<string, P>;
const target = (id: string) => tasks[id]?.target ?? 15;
const gen = practice as any;
const core = new Set<string>([...sqlDrills, ...pyDrills, ...traps].filter((x) => x.core).map((x) => x.id));
/** Exercises with a Check button: a pass is stored as solved (`ex:<id>`). */
function checkable(kind: string, id: string): boolean {
  if (kind === 'Task') return !!tasks[id];
  if (kind === 'Trap') return !!gen.traps[id]?.fixed;
  if (kind === 'Drill') {
    const sql = sqlDrills.find((d) => d.id === id);
    if (sql) return sql.check !== false && !!gen.sqlDrills[id]?.expected;
    return !!pyDrills.find((d) => d.id === id);
  }
  return false;
}

/** The clock of one mock task (decided with the mock interview page): 25 minutes, or the target + 10. */
export const mockClock = (t: number) => Math.max(25, t + 10);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** A full mock: a random SQL task and a random Python task on the mock clock, then the review. */
const MOCK_MIN =
  avg(Object.values(practice.sqlTasks as Record<string, P>).map((t) => mockClock(t.target ?? 15))) +
  avg(Object.values(practice.pyTasks as Record<string, P>).map((t) => mockClock(t.target ?? 15))) +
  MOCK_REVIEW;

interface Item {
  kind: 'Drill' | 'Trap' | 'Talk' | 'Playground' | 'Task';
  id: string;
}
interface PageStats {
  words: number;
  code: number;
  items: Item[];
  /** The TL;DR and "In the interview" boxes and the spoken questions only. */
  brief: { words: number; code: number; talks: number };
}

function textStats(src: string) {
  let code = 0;
  for (const m of src.matchAll(/```(\w*)[^\n]*\n([\s\S]*?)```/g)) code += m[2].split('\n').filter((l) => l.trim()).length;
  const text = src.replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>/g, ' ');
  const words = text.split(/[\s ]+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { words, code };
}

function pageStats(body: string): PageStats {
  const src = body.replace(/^import .*$/gm, '');
  const items: Item[] = [];
  for (const m of src.matchAll(/<(Drill|Trap|Talk|Playground|Task)\b(?:[^>]*?\bid=["']([^"']+)["'])?/g)) items.push({ kind: m[1] as Item['kind'], id: m[2] ?? '' });
  const boxes = [...src.matchAll(/<Aside\b[^>]*title=["'](?:TL;DR|Коротко|In the interview|На интервью)["'][^>]*>([\s\S]*?)<\/Aside>/g)].map((m) => m[1]);
  const talks = [...src.matchAll(/<Talk\b[^>]*>([\s\S]*?)<\/Talk>/g)].map((m) => m[1]);
  const b = textStats([...boxes, ...talks].join('\n'));
  return { ...textStats(src), items, brief: { ...b, talks: talks.length } };
}

const readMin = (words: number, code: number, locale: Locale) => words / (locale === 'ru' ? 125 : 150) + (code * 4) / 60;
const itemMin = (it: Item) => (it.kind === 'Task' ? target(it.id) * 1.5 : PER[it.kind]);

/** Does a timeline ask for this exercise on the page? (Optional ones are left out.) */
function inScope(it: Item, tl: Timeline, scope?: StepScope): boolean {
  if (scope?.brief) return it.kind === 'Talk';
  if (it.kind === 'Task') return !scope?.tasks || scope.tasks.includes(it.id);
  if ((it.kind === 'Drill' || it.kind === 'Trap') && timelines.find((x) => x.id === tl)?.coreOnly) return core.has(it.id);
  return true;
}

/** Minutes a timeline spends on a page: reading, its exercises, and a second attempt when the phase asks for one. */
function stepMinutes(st: PageStats, tl: Timeline, locale: Locale, scope?: StepScope, again = false): number {
  if (scope?.brief) return readMin(st.brief.words, st.brief.code, locale) + st.brief.talks * PER.Talk;
  const mine = st.items.filter((it) => inScope(it, tl, scope));
  let m = readMin(st.words, st.code, locale) + mine.reduce((s, it) => s + itemMin(it), 0);
  if (again) for (const it of mine) m += it.kind === 'Task' ? target(it.id) * AGAIN.Task : it.kind === 'Drill' ? AGAIN.Drill : 0;
  return m;
}

const TLS: Timeline[] = timelines.map((t) => t.id);
/** The step that shows a page in a timeline (the first one). */
const stepFor = (path: string, tl: Timeline) => studyPhases.flatMap((ph) => ph.steps).find((s) => s.path === path && shownIn(s, tl));

interface Built {
  nodes: MapNode[];
  stats: Map<string, PageStats>;
}
const cache = new Map<Locale, Promise<Built>>();

async function build(locale: Locale): Promise<Built> {
  const docs = await getCollection('docs');
  const enPaths = docs.filter((d) => d.id !== 'ru' && d.id !== '404' && !d.id.startsWith('ru/')).map((d) => (d.id === 'index' ? '' : `${d.id}/`));
  validateSkillMap(enPaths);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const deps = new Map<string, string[]>();
  for (const x of skillNodes) for (const d of x.needs) deps.set(d, [...(deps.get(d) ?? []), x.path]);
  const stats = new Map<string, PageStats>();
  const nodes = skillNodes.map((x) => {
    const id = (locale === 'ru' ? 'ru/' : '') + x.path.replace(/\/$/, '');
    const entry = byId.get(id);
    if (!entry) throw new Error(`Skill map: page ${id} not found`);
    const st = pageStats(entry.body ?? '');
    stats.set(x.path, st);
    const mins = Object.fromEntries(
      TLS.map((tl) => {
        const step = stepFor(x.path, tl);
        const m = step ? stepMinutes(st, tl, locale, step.scope?.[tl]) : stepMinutes(st, 'long', locale);
        return [tl, Math.max(step?.scope?.[tl]?.brief ? 1 : 3, Math.round(m))];
      }),
    ) as Record<Timeline, number>;
    const ex = Object.fromEntries(
      TLS.map((tl) => {
        const step = stepFor(x.path, tl);
        const scope = step?.scope?.[tl];
        for (const want of scope?.tasks ?? [])
          if (!st.items.some((it) => it.kind === 'Task' && it.id === want)) throw new Error(`Study plan step ${step!.id}: task ${want} is not on ${x.path}`);
        return [tl, st.items.filter((it) => checkable(it.kind, it.id) && (!step || inScope(it, tl, scope))).map((it) => it.id)];
      }),
    ) as Record<Timeline, string[]>;
    return {
      p: x.path,
      t: x.label?.[locale] ?? entry.data.title,
      title: entry.data.title,
      d: entry.data.description ?? '',
      tr: trackOf(x.path),
      needs: x.needs,
      deps: deps.get(x.path) ?? [],
      plans: plansFor(x.path),
      opt: optionalFor(x.path),
      ord: planOrder(x.path),
      min: Math.max(3, Math.round(stepMinutes(st, 'long', locale))),
      mins,
      ex,
    };
  });
  return { nodes, stats };
}

const built = (locale: Locale) => {
  if (!cache.has(locale)) cache.set(locale, build(locale));
  return cache.get(locale)!;
};

export async function mapNodes(locale: Locale): Promise<MapNode[]> {
  return (await built(locale)).nodes;
}

export interface PlanTime {
  /** Counted steps. */
  steps: number;
  /** Study minutes of the counted steps, second attempts and mock interviews. */
  minutes: number;
  /** Minutes of the optional steps. */
  optional: number;
  /** Hours a day over the timeline's days (low, high), rounded to half an hour. */
  perDay: [number, number];
}
export interface StepInfo {
  /** Estimated minutes per timeline that shows the step. */
  min: Partial<Record<Timeline, number>>;
  /** Exercise ids the step asks for, per timeline that shows it. */
  ex: Partial<Record<Timeline, string[]>>;
}

const half = (h: number) => Math.max(0.5, Math.round(h * 2) / 2);

/** Study time of every timeline and of every step, from the same estimate as the map. */
export async function planTimes(locale: Locale): Promise<{ plans: Record<Timeline, PlanTime>; steps: Map<string, StepInfo> }> {
  const { nodes, stats } = await built(locale);
  const exOf = new Map(nodes.map((n) => [n.p, n.ex]));
  const steps = new Map<string, StepInfo>();
  const plans = {} as Record<Timeline, PlanTime>;
  for (const tl of timelines) {
    const seen = new Set<string>();
    let minutes = 0;
    let optional = 0;
    let count = 0;
    for (const ph of studyPhases)
      for (const s of ph.steps) {
        if (!shownIn(s, tl.id)) continue;
        const st = stats.get(s.path)!;
        const first = !seen.has(s.path);
        seen.add(s.path);
        const m = first ? stepMinutes(st, tl.id, locale, s.scope?.[tl.id], !!ph.again?.includes(tl.id)) : 0;
        const info = steps.get(s.id) ?? { min: {}, ex: {} };
        info.min[tl.id] = Math.max(1, Math.round(m));
        info.ex[tl.id] = first ? exOf.get(s.path)![tl.id] : [];
        steps.set(s.id, info);
        if (countsIn(s, tl.id)) {
          count++;
          minutes += m;
        } else optional += m;
      }
    minutes += ((tl.mocks[0] + tl.mocks[1]) / 2) * MOCK_MIN;
    const h = minutes / 60;
    plans[tl.id] = { steps: count, minutes: Math.round(minutes), optional: Math.round(optional), perDay: [half(h / tl.days[1]), half(h / tl.days[0])] };
  }
  return { plans, steps };
}

export const pageHref = (path: string, locale: Locale) => {
  const raw = import.meta.env.BASE_URL;
  const base = raw.endsWith('/') ? raw : `${raw}/`;
  return `${base}${locale === 'ru' ? 'ru/' : ''}${path}`;
};

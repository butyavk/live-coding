// State shared by the study plan and the skill map (and read by the mock interview picker):
// the chosen plan, the reset of reading progress, solved exercises, and the flashcard store.
// Everything lives in this browser's localStorage; every access is guarded.
import { loadProgress, saveProgress, type Progress } from './progress';
import { DEFAULT_TIMELINE, stepKeys, type Timeline } from '~/data/study-plan';

/** The chosen plan: a plain string, `short` | `medium` | `long`. */
export const PLAN_KEY = 'lcm-study-plan';
/** The skill map's own choice before both pages shared PLAN_KEY. */
const OLD_MAP_PLAN = 'lcm-map-plan';
const PLAN_EVENT = 'lcm-plan';
const PLANS: Timeline[] = ['short', 'medium', 'long'];
const isPlan = (v: unknown): v is Timeline => typeof v === 'string' && (PLANS as string[]).includes(v);

const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

let memoryPlan: Timeline | null = null;

/**
 * The chosen plan. Moves older values into PLAN_KEY once: the study plan's JSON
 * (`{ timeline, done }`, whose ticks are merged into the shared progress) and the map's
 * `lcm-map-plan`. A value in the new format wins; then the plan's old choice; then the map's.
 */
export function readPlan(): Timeline {
  const raw = get(PLAN_KEY);
  if (isPlan(raw)) {
    if (get(OLD_MAP_PLAN) !== null) set(OLD_MAP_PLAN, null);
    return raw;
  }
  let plan: Timeline | null = null;
  if (raw) {
    try {
      const old = JSON.parse(raw);
      if (old && typeof old === 'object') {
        if (isPlan(old.timeline)) plan = old.timeline;
        mergeOldTicks(old.done);
      }
    } catch {
      /* not JSON: ignore */
    }
  }
  const map = get(OLD_MAP_PLAN);
  plan ??= isPlan(map) ? map : null;
  if (plan || raw !== null || map !== null) {
    set(PLAN_KEY, plan ?? DEFAULT_TIMELINE);
    set(OLD_MAP_PLAN, null);
  }
  return plan ?? memoryPlan ?? DEFAULT_TIMELINE;
}

/** Saves the chosen plan and tells the other component on this page. */
export function writePlan(tl: Timeline): void {
  memoryPlan = tl;
  set(PLAN_KEY, tl);
  set(OLD_MAP_PLAN, null);
  window.dispatchEvent(new CustomEvent(PLAN_EVENT));
}

/** Calls `cb` when the plan changes in this tab or in another one. */
export function onPlanChange(cb: () => void): void {
  window.addEventListener(PLAN_EVENT, cb);
  window.addEventListener('storage', (e) => {
    if (e.key === PLAN_KEY || e.key === null) cb();
  });
}

/** The study plan once kept ticks per timeline; they belong to the shared progress now. */
function mergeOldTicks(done: unknown) {
  const p = loadProgress();
  if (p.migrated) return;
  const keys = stepKeys();
  if (done && typeof done === 'object')
    for (const ids of Object.values(done as Record<string, unknown>))
      if (Array.isArray(ids))
        for (const id of ids) {
          const key = keys.get(String(id));
          if (key?.startsWith('page:')) p.learned[key.slice(5)] ??= Date.now();
          else if (key?.startsWith('act:')) p.activities[key.slice(4)] ??= Date.now();
        }
  p.migrated = true;
  saveProgress(p);
}

/** How many of these exercises have passed Check (stored by the practice blocks as `ex:<id>`). */
export const solvedOf = (ids: string[], p: Progress = loadProgress()) => ids.filter((id) => !!p.activities[`ex:${id}`]).length;

const DRAFT_PREFIXES = ['lcm-draft:', 'lcm-timer:'];

/**
 * The one Reset of the map and the plan: pages marked as learned, pages opened, plan ticks and
 * solved exercises. The chosen plan, the map's look and the flashcards stay. With `drafts`,
 * the code drafts and task timers go too.
 */
export function resetProgress({ drafts = false } = {}): void {
  if (drafts) {
    try {
      const keys = Object.keys(localStorage).filter((k) => DRAFT_PREFIXES.some((p) => k.startsWith(p)));
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
  }
  saveProgress({ v: 1, learned: {}, visited: {}, activities: {}, migrated: true });
}

/** Strings of the reset panel, the same on both pages. */
export const RESET_TEXT = {
  en: {
    button: 'Reset progress',
    ask: 'Clear the pages marked as learned, the pages opened, the plan ticks and the solved exercises, on the map and in the study plan? The chosen plan and the flashcards stay.',
    drafts: 'Also delete the code drafts and the task timers',
    yes: 'Reset',
    no: 'Cancel',
    done: 'Progress reset.',
  },
  ru: {
    button: 'Сбросить прогресс',
    ask: 'Удалить отметки «изучено», открытые страницы, отметки плана и решённые упражнения — на карте и в плане подготовки? Выбранный план и карточки останутся.',
    drafts: 'Удалить также черновики кода и таймеры задач',
    yes: 'Сбросить',
    no: 'Отмена',
    done: 'Прогресс сброшен.',
  },
} as const;

/**
 * Wires a reset panel: `[data-reset-open]` shows `[data-reset-panel]`, which holds a
 * `[data-reset-drafts]` checkbox and `[data-reset-yes]` / `[data-reset-no]` buttons.
 */
export function wireReset(root: HTMLElement, onDone?: () => void): void {
  const open = root.querySelector<HTMLButtonElement>('[data-reset-open]');
  const panel = root.querySelector<HTMLElement>('[data-reset-panel]');
  if (!open || !panel) return;
  const drafts = panel.querySelector<HTMLInputElement>('[data-reset-drafts]')!;
  const msg = root.querySelector<HTMLElement>('[data-reset-msg]');
  const show = (on: boolean) => {
    panel.hidden = !on;
    open.setAttribute('aria-expanded', String(on));
    if (on) {
      drafts.checked = false;
      if (msg) msg.textContent = '';
      panel.querySelector<HTMLButtonElement>('[data-reset-no]')!.focus();
    } else open.focus();
  };
  open.addEventListener('click', () => show(panel.hidden));
  panel.querySelector('[data-reset-no]')!.addEventListener('click', () => show(false));
  panel.querySelector('[data-reset-yes]')!.addEventListener('click', () => {
    resetProgress({ drafts: drafts.checked });
    show(false);
    if (msg) msg.textContent = msg.dataset.done ?? '';
    onDone?.();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      show(false);
    }
  });
}

// ---------------------------------------------------------------- flashcards
/** Flashcard boxes, shared by both languages (cards have the same ids in both). */
export const FLASH_KEY = 'lcm-flashcards';
/** Per-language stores before FLASH_KEY. */
export const OLD_FLASH_KEYS = ['lcm-flashcards-en', 'lcm-flashcards-ru'];

type Box = { b: number; d: number };
type FlashStore = { v: 1; cards: Record<string, Box>; section?: string; shuffle?: boolean };
const readStore = (k: string): FlashStore | null => {
  try {
    const v = JSON.parse(get(k) || 'null');
    return v && typeof v === 'object' && v.cards && typeof v.cards === 'object' ? v : null;
  } catch {
    return null;
  }
};

/**
 * Merges the old per-language flashcard stores into FLASH_KEY (once: the old keys are removed).
 * For a card known in both, the higher box wins; in the same box, the earlier review day.
 */
export function migrateFlashcards(): void {
  const olds = OLD_FLASH_KEYS.map(readStore).filter((s): s is FlashStore => !!s);
  if (!olds.length) {
    // Old keys that hold nothing usable: drop them.
    for (const k of OLD_FLASH_KEYS) if (get(k) !== null) set(k, null);
    return;
  }
  const into: FlashStore = readStore(FLASH_KEY) ?? { v: 1, cards: {} };
  for (const s of olds) {
    for (const [id, box] of Object.entries(s.cards)) {
      if (!box || typeof box.b !== 'number' || typeof box.d !== 'number') continue;
      const cur = into.cards[id];
      if (!cur || box.b > cur.b || (box.b === cur.b && box.d < cur.d)) into.cards[id] = box;
    }
    into.section ??= s.section;
    into.shuffle ??= s.shuffle;
  }
  try {
    localStorage.setItem(FLASH_KEY, JSON.stringify(into));
    for (const k of OLD_FLASH_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable: try again next time */
  }
}

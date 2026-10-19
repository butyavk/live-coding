// The mock interview, shared by the picker (MockInterview.astro), the mock pages (MockPage.astro)
// and client.ts: the address of a task's mock page, the clock and the queue of tasks in
// sessionStorage. The picker reads the study plan through readPlan() in
// src/components/lib/plan-store.ts.

/**
 * The page of a task in a mock: /mock/<id>/ or /ru/mock/<id>/ (src/pages/). The address names no
 * topic, as a real interviewer never says which pattern a task belongs to.
 */
export const mockHref = (id: string, ru: boolean) => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${ru ? 'ru/' : ''}mock/${id}/`;

/**
 * Minutes a task gets in a mock: 25, the slot a task gets in a real round; the hardest tasks get
 * their target plus 10. "Both" (one SQL and one Python task) gets the sum. The target itself is the
 * time a prepared candidate needs once the questions are settled; the normal timer keeps using it.
 */
export const mockMinutes = (target: number) => Math.max(25, target + 10);

export interface MockItem {
  id: string;
  url: string;
  mins: number;
}
/** The state of one task's clock, as the task timer keeps it. */
export interface MockClock {
  elapsed: number;
  running: boolean;
  since: number;
}
export interface MockPlan {
  /** The tasks still to do; the first one is the task on screen. */
  queue: MockItem[];
  /** The page to go back to for another mock. */
  back: string;
  /** Tasks in the whole mock, and minutes for all of them (the sum). */
  count: number;
  total: number;
  /** Each task's clock, so a reload during the mock does not reset it. */
  clock?: Record<string, MockClock>;
}

export const MOCK_KEY = 'lcm-mock';

/** A task whose mock has ended in this tab: a reload of its page shows the self-review again. */
export interface MockEnded {
  /** Seconds the task took, and the minutes the clock gave. */
  used: number;
  mins: number;
  /** The next task's page in a mock of both kinds, or ''. */
  next: string;
  /** The page to go back to for another mock. */
  back: string;
}
export const endedKey = (id: string) => `lcm-mock-ended:${id}`;

export function readMock(): MockPlan | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(MOCK_KEY) || 'null');
    return p && Array.isArray(p.queue) ? p : null;
  } catch {
    return null;
  }
}

export function writeMock(p: MockPlan | null) {
  try {
    if (p) sessionStorage.setItem(MOCK_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(MOCK_KEY);
  } catch {
    /* storage blocked: the mock still works for this page */
  }
}

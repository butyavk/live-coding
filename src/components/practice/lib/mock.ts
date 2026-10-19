// The mock interview, shared by the picker (MockInterview.astro) and the task pages (client.ts):
// the clock and the queue of tasks in sessionStorage. The picker reads the study plan through
// readPlan() in src/components/lib/plan-store.ts.

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

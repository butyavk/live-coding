// One PostgreSQL worker and one Python worker per page, shared by every exercise on it.
// Both start lazily, on the first Run or Check, and can be stopped: stopping terminates the
// worker and the next call starts a fresh one. The workers live in public/runtime/
// (copied from src/runtime/ by scripts/copy-runtimes.mjs).

const rawBase = import.meta.env.BASE_URL;
export const BASE = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
const RUNTIME = `${BASE}runtime/`;

export type State = 'idle' | 'loading' | 'ready' | 'failed';
type Listener = () => void;

export interface SqlError {
  message: string;
  position?: number | null;
  hint?: string | null;
  detail?: string | null;
}
export interface SqlRun {
  results: { fields: { name: string; typeId: number }[]; rows: unknown[][]; affected: number | null }[];
  error: SqlError | null;
  ms: number;
  stopped?: boolean;
  timeout?: boolean;
}

interface Pending {
  resolve: (m: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

class Emitter {
  private subs = new Set<Listener>();
  on(fn: Listener) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
  emit() {
    this.subs.forEach((f) => f());
  }
}

// ---------------------------------------------------------------- PostgreSQL
class Postgres extends Emitter {
  state: State = 'idle';
  failure = '';
  version = '';
  /** The hidden edge-case data (schema `edge`) loaded: Check can run answers there too. */
  edge = false;
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  private ready: Promise<boolean> | null = null;

  /** Starts the worker if needed; resolves true when PostgreSQL is ready, false if it failed. */
  ensure(): Promise<boolean> {
    if (this.state === 'ready') return Promise.resolve(true);
    if (this.ready && this.state === 'loading') return this.ready;
    this.state = 'loading';
    this.failure = '';
    this.emit();
    this.ready = new Promise((resolve) => {
      let w: Worker;
      try {
        w = new Worker(`${RUNTIME}pg-worker.js`, { type: 'module' });
      } catch (e: any) {
        this.fail(String(e?.message ?? e));
        resolve(false);
        return;
      }
      this.worker = w;
      const boot = setTimeout(() => {
        if (this.state === 'loading') {
          this.fail('no answer in 120 s');
          resolve(false);
        }
      }, 120000);
      w.onmessage = (e: MessageEvent) => {
        const m = e.data || {};
        if (m.type === 'ready') {
          clearTimeout(boot);
          this.state = 'ready';
          this.version = String(m.version || '');
          this.edge = !!m.edge;
          this.emit();
          resolve(true);
        } else if (m.type === 'fail') {
          clearTimeout(boot);
          this.fail(String(m.message || 'unknown error').split('\n')[0]);
          resolve(false);
        } else if (m.type === 'result' || m.type === 'qres') {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            clearTimeout(p.timer);
            p.resolve(m);
          }
        }
      };
      w.onerror = (e) => {
        if (this.state !== 'loading') return;
        clearTimeout(boot);
        this.fail((e && (e as ErrorEvent).message) || 'the worker did not load');
        resolve(false);
      };
    });
    return this.ready;
  }

  private fail(msg: string) {
    this.state = 'failed';
    this.failure = msg;
    this.worker?.terminate();
    this.worker = null;
    this.emit();
  }

  /** Terminates the worker; everything pending resolves as stopped. */
  stop(reason: 'stopped' | 'timeout' = 'stopped') {
    this.worker?.terminate();
    this.worker = null;
    this.state = 'idle';
    this.ready = null;
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ id, [reason]: true });
    }
    this.pending.clear();
    this.emit();
  }

  private send(msg: object, timeoutMs: number): Promise<any> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ id, timeout: true });
        this.stop('timeout');
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  /** Runs a script in a transaction that is rolled back. `schema: 'edge'` runs it on the hidden edge-case data. */
  async run(sql: string, timeoutMs = 20000, schema: 'public' | 'edge' = 'public'): Promise<SqlRun> {
    if (!(await this.ensure())) return { results: [], error: { message: this.failure }, ms: 0 };
    const m = await this.send({ type: 'run', sql, schema }, timeoutMs);
    if (m.stopped || m.timeout) return { results: [], error: null, ms: 0, stopped: !!m.stopped, timeout: !!m.timeout };
    return { results: m.results ?? [], error: m.error ?? null, ms: m.ms ?? 0 };
  }

  /** For Python's db.py: one statement with $1… parameters; resolves with a JSON string. */
  async query(sql: string, params: unknown[], timeoutMs = 20000): Promise<string> {
    const err = (message: string) => JSON.stringify({ error: { message } });
    if (!(await this.ensure())) return err(`PostgreSQL did not start: ${this.failure}`);
    const m = await this.send({ type: 'query', sql, params }, timeoutMs);
    if (m.stopped || m.timeout) return err(m.timeout ? `The query ran longer than ${timeoutMs / 1000} s and was stopped.` : 'Stopped.');
    return m.json;
  }
}

// ---------------------------------------------------------------- Python
const ROOT = '/home/pyodide/lc';
const SHARED: [string, string][] = [
  ['py/_lc.py', `${ROOT}/_lc/_lc.py`],
  ['py/pytest.py', `${ROOT}/_lc/pytest.py`],
  ['py/conftest.py', `${ROOT}/tests/conftest.py`],
  ['py/db.py', `${ROOT}/db.py`],
  ['solutions/sql/q04.sql', `${ROOT}/solutions/sql/q04.sql`],
];

export interface PyCall {
  json?: string | null;
  error?: string | null;
  stopped?: boolean;
  timeout?: boolean;
}

class Python extends Emitter {
  state: State = 'idle';
  failure = '';
  version = '';
  jspi = false;
  busy = false;
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending & { onOut?: (t: string) => void }>();
  private ready: Promise<boolean> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private written = new Set<string>();

  ensure(): Promise<boolean> {
    if (this.state === 'ready') return Promise.resolve(true);
    if (this.ready && this.state === 'loading') return this.ready;
    this.state = 'loading';
    this.failure = '';
    this.written.clear();
    this.emit();
    this.ready = (async () => {
      let files: Record<string, string>;
      try {
        const texts = await Promise.all(SHARED.map(([src]) => fetch(`${RUNTIME}${src}`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${src}: HTTP ${r.status}`))))));
        files = Object.fromEntries(SHARED.map(([, dst], i) => [dst, texts[i]]));
        files[`${ROOT}/tasks/__init__.py`] = '';
        files[`${ROOT}/scratch.py`] = '';
      } catch (e: any) {
        this.fail(String(e?.message ?? e));
        return false;
      }
      return new Promise<boolean>((resolve) => {
        let w: Worker;
        try {
          w = new Worker(`${RUNTIME}py-worker.js`, { type: 'module' });
        } catch (e: any) {
          this.fail(String(e?.message ?? e));
          resolve(false);
          return;
        }
        this.worker = w;
        const boot = setTimeout(() => {
          if (this.state === 'loading') {
            this.fail('no answer in 120 s');
            resolve(false);
          }
        }, 120000);
        w.onmessage = (e: MessageEvent) => {
          const m = e.data || {};
          if (m.type === 'ready') {
            clearTimeout(boot);
            this.state = 'ready';
            this.version = String(m.version || '');
            this.jspi = !!m.jspi;
            this.emit();
            resolve(true);
          } else if (m.type === 'fail') {
            clearTimeout(boot);
            this.fail(String(m.message || 'unknown error').split('\n')[0]);
            resolve(false);
          } else if (m.type === 'out') {
            for (const p of this.pending.values()) p.onOut?.(m.text);
          } else if (m.type === 'sql') {
            pg.query(m.sql, m.params).then((json) => {
              if (this.worker === w) w.postMessage({ type: 'sqlres', qid: m.qid, json });
            });
          } else if (m.type === 'result') {
            const p = this.pending.get(m.id);
            if (p) {
              this.pending.delete(m.id);
              clearTimeout(p.timer);
              p.resolve(m);
            }
          }
        };
        w.onerror = (e) => {
          if (this.state !== 'loading') return;
          clearTimeout(boot);
          this.fail((e && (e as ErrorEvent).message) || 'the worker did not load');
          resolve(false);
        };
        w.postMessage({ type: 'init', files });
      });
    })();
    return this.ready;
  }

  private fail(msg: string) {
    this.state = 'failed';
    this.failure = msg;
    this.worker?.terminate();
    this.worker = null;
    this.emit();
  }

  stop(reason: 'stopped' | 'timeout' = 'stopped') {
    this.worker?.terminate();
    this.worker = null;
    this.state = 'idle';
    this.ready = null;
    this.written.clear();
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ id, [reason]: true });
    }
    this.pending.clear();
    this.emit();
  }

  /** One call at a time: exercises on a page share the interpreter. */
  private call(msg: object, timeoutMs: number, onOut?: (t: string) => void): Promise<PyCall> {
    const job = this.queue.then(async () => {
      if (!(await this.ensure())) return { error: this.failure } as PyCall;
      const id = ++this.seq;
      this.busy = true;
      this.emit();
      const m: any = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          resolve({ id, timeout: true });
          this.stop('timeout');
        }, timeoutMs);
        this.pending.set(id, { resolve, timer, onOut });
        this.worker!.postMessage({ ...msg, id });
      });
      this.busy = false;
      this.emit();
      if (m.stopped || m.timeout) return { stopped: !!m.stopped, timeout: !!m.timeout };
      return { json: m.json, error: m.error };
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  /** Writes files into the interpreter's file system (kept until the worker restarts). */
  async write(files: Record<string, string>): Promise<boolean> {
    if (!(await this.ensure())) return false;
    const fresh = Object.fromEntries(Object.entries(files).filter(([p, t]) => !this.written.has(p + '\0' + t)));
    if (Object.keys(fresh).length) {
      this.worker!.postMessage({ type: 'write', files: fresh });
      for (const [p, t] of Object.entries(fresh)) this.written.add(p + '\0' + t);
    }
    return true;
  }

  run(code: string, task = '', onOut?: (t: string) => void, timeoutMs = 15000) {
    return this.call({ type: 'run', task, code }, timeoutMs, onOut);
  }

  check(task: string, code: string, test: string, timeoutMs = 60000) {
    return this.call({ type: 'check', task, code, test }, timeoutMs);
  }

  /** Fetches tests/test_<mod>.py and writes it into the interpreter. */
  async loadTest(mod: string): Promise<string | null> {
    try {
      const r = await fetch(`${RUNTIME}tests/test_${mod}.py`);
      if (!r.ok) return `tests/test_${mod}.py: HTTP ${r.status}`;
      const ok = await this.write({ [`${ROOT}/tests/test_${mod}.py`]: await r.text() });
      return ok ? null : this.failure;
    } catch (e: any) {
      return String(e?.message ?? e);
    }
  }
}

export const pg = new Postgres();
export const py = new Python();

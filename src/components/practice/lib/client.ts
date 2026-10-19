// Browser side of the practice components. Finds every [data-lcp] block on the page and wires
// it up: the editor (CodeMirror, loaded when the block scrolls into view), Run / Check / Reset /
// Stop, drafts, the timer and the soft lock of task solutions and walkthroughs, "Start fresh",
// progress (`ex:<id>`) and the mock interview mode.
import { strings } from './i18n';
import { pg, py, type SqlRun } from './runtime';
import { compareEdge, compareResult, edgePrint, type EdgeExpected, type ExpectedSet, type Verdict } from './compare';
import { banner, el, lastResult, pyErrorView, sqlRunView, userLine, verdictView, type PyErr } from './dom';
import type { Editor } from './editor';
import { mockMinutes, readMock, writeMock, type MockClock, type MockPlan } from './mock';
import { loadProgress, onProgressChange, setActivity } from '../../lib/progress';

const isRu = !!document.documentElement.lang?.toLowerCase().startsWith('ru');
const T = strings(isRu ? 'ru' : 'en');

let editorModule: Promise<typeof import('./editor')> | null = null;
const loadEditor = () => (editorModule ??= import('./editor'));

interface Store {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}
const storeOf = (area: () => Storage): Store => ({
  get(key) {
    try {
      return area().getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) area().removeItem(key);
      else area().setItem(key, value);
    } catch {
      /* storage blocked: drafts last for this page view */
    }
  },
});
const store = storeOf(() => localStorage);
/** Mock interviews keep their own code for the tab, so a reload does not lose it. */
const session = storeOf(() => sessionStorage);

/** True while the page is in mock interview mode (?mock=<id>). */
let mockActive = false;

interface Cfg {
  kind: string;
  id: string;
  starter: string;
  ordered?: boolean;
  check?: boolean;
  expected?: ExpectedSet | null;
  schema?: Record<string, string[]>;
  harness?: string;
  target?: number;
  mod?: string;
  code?: string;
  db?: boolean;
  /** Fingerprint of the reference on the hidden edge-case data. */
  edge?: EdgeExpected | null;
  /** Column names the task asks for (tasks only; Check does not enforce them). */
  specCols?: string[];
}

/** WebAssembly JSPI: Python can wait for the database (db.py). Missing in Safari and Firefox today. */
const hasJspi = () => typeof (WebAssembly as any).Suspending === 'function';

const solvedKey = (id: string) => `ex:${id}`;
const isSolved = (id: string) => !!id && !!loadProgress().activities[solvedKey(id)];
const MAIN_GUARD = 'if __name__ == "__main__":';

class Block {
  root: HTMLElement;
  cfg: Cfg;
  host: HTMLElement;
  bar: HTMLElement;
  status: HTMLElement;
  verdict: HTMLElement;
  out: HTMLElement;
  editor: Editor | null = null;
  private mounting: Promise<Editor> | null = null;
  protected busy = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  passed = false;
  private draftKey: string | null;
  private drafts: Store = store;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.cfg = JSON.parse(root.querySelector<HTMLScriptElement>('script[data-lcp-cfg]')!.textContent || '{}');
    const work = root.querySelector<HTMLElement>('.lcp-work')!;
    this.host = work.querySelector<HTMLElement>('[data-editor]')!;
    this.bar = work.querySelector<HTMLElement>('[data-bar]')!;
    this.status = work.querySelector<HTMLElement>('[data-status]')!;
    this.verdict = work.querySelector<HTMLElement>('[data-verdict]')!;
    this.out = work.querySelector<HTMLElement>('[data-out]')!;
    this.draftKey = this.cfg.id ? `lcm-draft:${this.cfg.id}` : null;
    this.bar.hidden = false;
    this.button('run')?.addEventListener('click', () => this.run());
    this.button('check')?.addEventListener('click', () => this.check());
    this.button('reset')?.addEventListener('click', () => this.reset());
    this.button('stop')?.addEventListener('click', () => this.stop());
    this.host.addEventListener('click', () => this.mount().then((e) => e.focus()), { once: true });
    this.syncSolved();
    onProgressChange(() => this.syncSolved());
  }

  get lang(): 'sql' | 'python' {
    return this.host.dataset.lang === 'python' ? 'python' : 'sql';
  }
  get pyFile() {
    return this.cfg.mod ? `tasks/${this.cfg.mod}.py` : 'scratch.py';
  }

  button(act: string) {
    return this.bar.querySelector<HTMLButtonElement>(`[data-act="${act}"]`);
  }

  syncSolved() {
    const solved = this.passed || isSolved(this.cfg.id);
    const mark = this.root.querySelector<HTMLElement>('[data-solved]');
    if (mark) mark.hidden = !solved;
    const fresh = this.root.querySelector<HTMLElement>('[data-fresh]');
    if (fresh) fresh.hidden = !solved || mockActive;
  }

  /** The draft the reader saved outside a mock, when it differs from the starter code. */
  savedDraft(): string | null {
    const d = this.cfg.id ? store.get(`lcm-draft:${this.cfg.id}`) : null;
    return d && d !== (this.cfg.starter ?? '') ? d : null;
  }
  /** In a mock the editor starts from the starter code and keeps its text for this tab only. */
  mockDrafts(on: boolean) {
    if (!this.cfg.id) return;
    this.draftKey = on ? `lcm-mock-draft:${this.cfg.id}` : `lcm-draft:${this.cfg.id}`;
    this.drafts = on ? session : store;
  }

  /** Replaces the fallback <pre> with CodeMirror (once). */
  mount(): Promise<Editor> {
    if (this.editor) return Promise.resolve(this.editor);
    this.mounting ??= loadEditor().then(({ createEditor }) => {
      const draft = this.draftKey ? this.drafts.get(this.draftKey) : null;
      this.host.replaceChildren();
      this.editor = createEditor(this.host, {
        lang: this.lang,
        doc: draft ?? this.cfg.starter ?? '',
        label: T.editorLabel,
        placeholder: this.lang === 'sql' ? T.sqlPlaceholder : undefined,
        schema: this.cfg.schema,
        onRun: () => this.run(),
        onCheck: this.button('check') ? () => this.check() : undefined,
        onChange: (doc) => this.saveDraft(doc),
      });
      return this.editor;
    });
    return this.mounting;
  }

  private saveDraft(doc: string) {
    if (!this.draftKey) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const [drafts, key] = [this.drafts, this.draftKey];
    this.saveTimer = setTimeout(() => drafts.set(key, doc === (this.cfg.starter ?? '') ? null : doc), 400);
  }

  async reset() {
    const ed = await this.mount();
    ed.set(this.cfg.starter ?? '');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.draftKey) this.drafts.set(this.draftKey, null);
    this.verdict.replaceChildren();
    this.out.replaceChildren();
    ed.focus();
  }

  /** Marks the block busy; after a second a Stop button appears. Returns a function that ends it. */
  protected begin(): () => void {
    this.busy = true;
    for (const a of ['run', 'check', 'example']) {
      const b = this.button(a);
      if (b) b.disabled = true;
    }
    const stop = this.button('stop');
    this.stopTimer = setTimeout(() => {
      if (stop) stop.hidden = false;
    }, 1000);
    return () => {
      this.busy = false;
      if (this.stopTimer) clearTimeout(this.stopTimer);
      if (stop) stop.hidden = true;
      for (const a of ['run', 'check', 'example']) {
        const b = this.button(a);
        if (b) b.disabled = false;
      }
    };
  }

  stop() {
    if (this.lang === 'sql') pg.stop();
    else py.stop();
  }

  protected setStatus(text: string, kind: 'info' | 'fail' = 'info') {
    if (!text) {
      this.status.replaceChildren();
      return;
    }
    this.status.replaceChildren(el('span', { class: `lcp-status-line lcp-${kind}` }, el('span', { class: 'lcp-icon', 'aria-hidden': 'true', text: kind === 'fail' ? '✕' : '↻' }), ` ${text}`));
  }

  /** Shows the runtime's state while it starts. */
  protected async ready(which: 'sql' | 'python'): Promise<boolean> {
    const rt = which === 'sql' ? pg : py;
    if (rt.state !== 'ready') this.setStatus(which === 'sql' ? T.pgLoading : T.pyLoading);
    const ok = await rt.ensure();
    if (!ok) {
      this.setStatus(which === 'sql' ? T.pgFailed(rt.failure) : T.pyFailed(rt.failure), 'fail');
      return false;
    }
    this.setStatus(T.running);
    return true;
  }

  pass() {
    this.passed = true;
    if (this.cfg.id) setActivity(solvedKey(this.cfg.id), true);
    this.syncSolved();
  }

  run(): Promise<unknown> {
    return Promise.resolve();
  }
  check(): Promise<unknown> {
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------- SQL
class SqlBlock extends Block {
  protected lastOut: SqlRun | null = null;

  async exec(whole: boolean): Promise<SqlRun | null> {
    if (this.busy) return null;
    const ed = await this.mount();
    const { text, lineOffset } = whole ? { text: ed.get(), lineOffset: 0 } : ed.selectionOrAll();
    const end = this.begin();
    try {
      this.verdict.replaceChildren();
      if (!(await this.ready('sql'))) return null;
      const out = await pg.run(text);
      this.setStatus('');
      const line = sqlRunView(this.out, out, text, lineOffset, T);
      if (line) ed.markLine(line);
      this.lastOut = out;
      return out;
    } finally {
      end();
    }
  }

  async run() {
    await this.exec(false);
  }

  /**
   * Compares the whole editor's last result with the reference, then runs the same text on the
   * hidden edge-case data (schema `edge`) and compares fingerprints. Column names never count.
   */
  async compare(exp: ExpectedSet): Promise<boolean | null> {
    const out = await this.exec(true);
    if (!out || out.stopped || out.timeout) return null;
    if (out.error) {
      this.verdict.replaceChildren(banner('fail', T.fail, el('div', { text: T.fixError })));
      return false;
    }
    const last = lastResult(out);
    if (!last) {
      this.verdict.replaceChildren(banner('fail', T.fail, el('div', { text: T.noSelect })));
      return false;
    }
    const v = compareResult(last, exp, { ordered: !!this.cfg.ordered }, T);
    this.verdict.replaceChildren(this.verdictOf(v));
    if (!v.ok) return false;
    const edge = await this.edgeCheck(this.editor!.get());
    if (edge === null) return null;
    if (edge) {
      this.verdict.replaceChildren(banner('fail', T.fail, el('div', { text: T.edgeIntro }), el('div', { text: edge }), el('div', { class: 'lcp-small', text: T.edgeThink })));
      return false;
    }
    if (edge === '') this.verdict.replaceChildren(banner('pass', T.edgePass));
    return true;
  }

  /**
   * Runs the text on the hidden edge-case data. Returns '' when it matches, a message when it does
   * not, undefined when there is nothing to compare (no fingerprint, or the data did not load),
   * null when the run was stopped.
   */
  private async edgeCheck(text: string): Promise<string | null | undefined> {
    const exp = this.cfg.edge;
    if (!exp || !pg.edge) return undefined;
    const end = this.begin();
    try {
      this.setStatus(T.edgeChecking);
      const out = await pg.run(text, 20000, 'edge');
      this.setStatus('');
      if (out.stopped) return null;
      if (out.timeout) return T.timeout(20);
      if (out.error) return `${T.edgeError} ${out.error.message}`;
      const last = lastResult(out);
      if (!last) return T.noSelect;
      return compareEdge(await edgePrint(last), exp, T) ?? '';
    } finally {
      end();
    }
  }

  /** Drills and traps are for learning: a failed Check shows the expected values. */
  protected verdictOf(v: Verdict): HTMLElement {
    return verdictView(v, T);
  }

  async check() {
    if (!this.cfg.expected) return;
    if (await this.compare(this.cfg.expected)) this.pass();
  }
}

/**
 * A failed Check on a task: where the difference is (row count, column, row) and its kind, the way
 * an interviewer would point at it, but not the expected value. Outside a mock, a button shows it;
 * in a mock, never.
 */
function taskVerdictView(v: Verdict): HTMLElement {
  if (v.ok) return banner('pass', T.pass);
  const J = (x: unknown) => JSON.stringify(x);
  const kids: Node[] = [el('div', { text: v.msg ?? '' })];
  if (v.diffCols?.length) kids.push(el('div', { text: T.diffCols(v.diffCols) }));
  if (v.kind && T.diffKind[v.kind]) kids.push(el('div', { text: T.diffKind[v.kind] }));
  if (v.got) kids.push(el('pre', { class: 'lcp-diff', text: `${T.yoursLabel}: ${J(v.got)}` }));
  if (v.extra?.length) kids.push(el('div', { class: 'lcp-small', text: `${T.extraEx} ${v.extra.map((r) => J(r)).join('; ')}` }));
  const hidden: Node[] = [];
  if (v.exp) hidden.push(el('pre', { class: 'lcp-diff', text: `${T.expectedLabel}: ${J(v.exp)}` }));
  if (v.missing?.length) hidden.push(el('div', { class: 'lcp-small', text: `${T.missingEx} ${v.missing.map((r) => J(r)).join('; ')}` }));
  if (hidden.length && !mockActive) {
    const box = el('div', { class: 'lcp-expected', 'data-expected': '', hidden: true }, hidden);
    const btn = el('button', { type: 'button', class: 'lcp-btn lcp-btn-small', 'data-show-expected': '', text: T.showExpected });
    btn.addEventListener('click', () => {
      box.hidden = false;
      btn.remove();
    });
    kids.push(el('div', null, btn), box);
  }
  return banner('fail', T.fail, kids);
}

class TrapBlock extends SqlBlock {
  async run() {
    await this.exec(false);
    const ans = this.root.querySelector<HTMLDetailsElement>('[data-answer]');
    if (ans && !ans.open) ans.open = true;
  }
}

// ---------------------------------------------------------------- timer and lock (tasks)
class Timer {
  private key: string;
  private s: MockClock = { elapsed: 0, running: false, since: 0 };
  private tick: ReturnType<typeof setInterval> | null = null;
  /** Minutes before the timer turns "over": the task's target, or the mock clock in a mock. */
  limit: number;
  /** In a mock the state goes to the mock plan (this tab), not to the practice timer. */
  private mockSave: ((s: MockClock) => void) | null = null;
  constructor(
    private box: HTMLElement,
    id: string,
    private target: number,
  ) {
    this.key = `lcm-timer:${id}`;
    this.limit = target;
    try {
      const v = JSON.parse(store.get(this.key) || 'null');
      if (v && typeof v.elapsed === 'number') this.s = v;
    } catch {
      /* ignore */
    }
    box.hidden = false;
    box.querySelector('[data-timer="toggle"]')!.addEventListener('click', () => (this.s.running ? this.pause() : this.start()));
    box.querySelector('[data-timer="reset"]')!.addEventListener('click', () => this.reset());
    this.render();
    if (this.s.running) this.loop();
  }
  get seconds() {
    return this.s.elapsed + (this.s.running ? (Date.now() - this.s.since) / 1000 : 0);
  }
  get over() {
    return this.seconds >= this.limit * 60;
  }
  get running() {
    return this.s.running;
  }
  private save() {
    if (this.mockSave) this.mockSave({ ...this.s });
    else store.set(this.key, JSON.stringify(this.s));
  }
  private loop() {
    if (this.tick) clearInterval(this.tick);
    this.tick = setInterval(() => this.render(), 1000);
  }
  start() {
    if (this.s.running) return;
    this.s.running = true;
    this.s.since = Date.now();
    this.save();
    this.loop();
    this.render();
  }
  /** Starts the timer the first time the reader runs anything. */
  autostart() {
    if (!this.s.running && this.s.elapsed === 0) this.start();
  }
  pause() {
    if (!this.s.running) return;
    this.s.elapsed = this.seconds;
    this.s.running = false;
    this.save();
    if (this.tick) clearInterval(this.tick);
    this.render();
  }
  reset() {
    this.s = { elapsed: 0, running: false, since: 0 };
    this.save();
    if (this.tick) clearInterval(this.tick);
    this.render();
  }
  /** Mock mode: the mock clock, resumed from `state` after a reload, saved through `save`. */
  mock(state: MockClock | null, minutes: number, save: (s: MockClock) => void) {
    this.mockSave = save;
    this.limit = minutes;
    if (this.tick) clearInterval(this.tick);
    this.s = state ? { ...state } : { elapsed: 0, running: false, since: 0 };
    if (!state) this.start();
    else if (this.s.running) this.loop();
    this.render();
  }
  /** The mock is over: the time it took stays on the practice timer, paused. */
  endMock() {
    this.mockSave = null;
    this.limit = this.target;
    if (this.s.running) this.pause();
    else this.save();
    this.render();
  }
  private render() {
    const sec = Math.floor(this.seconds);
    this.box.querySelector('[data-timer-display]')!.textContent = clock(sec);
    this.box.querySelector('[data-timer="toggle"]')!.textContent = this.s.running ? T.pause : T.start;
    this.box.classList.toggle('lcp-timer-over', this.over);
    this.box.title = this.over ? (this.mockSave ? T.mockOver : T.overTarget) : '';
  }
}
const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec) % 60).padStart(2, '0')}`;

/** A solution or a walkthrough: one click after a pass or after the time is up, otherwise a confirm step. */
function softLock(det: HTMLDetailsElement, lock: HTMLElement, unlocked: () => boolean, focus: () => void) {
  det.querySelector('summary')!.addEventListener('click', (e) => {
    if (det.open || unlocked()) return;
    e.preventDefault();
    lock.hidden = false;
    lock.querySelector<HTMLButtonElement>('[data-lock-act="keep"]')!.focus();
  });
  lock.querySelector('[data-lock-act="show"]')!.addEventListener('click', () => {
    lock.hidden = true;
    det.open = true;
  });
  lock.querySelector('[data-lock-act="keep"]')!.addEventListener('click', () => {
    lock.hidden = true;
    focus();
  });
}

/** The walkthrough of a task: the first <Reveal> after it, before the next heading or exercise. */
function walkOf(root: HTMLElement): HTMLDetailsElement | null {
  const content = root.closest('.sl-markdown-content');
  const top = content ? [...content.children].find((c) => c.contains(root)) : null;
  for (let n = top?.nextElementSibling as HTMLElement | null; n; n = n.nextElementSibling as HTMLElement | null) {
    if (n.matches('details.lcp-reveal')) return n as HTMLDetailsElement;
    if (/^H[1-6]$/.test(n.tagName) || n.classList.contains('sl-heading-wrapper') || n.matches('[data-lcp]') || n.querySelector('[data-lcp]')) break;
  }
  return null;
}

type TaskBlock = SqlTask | PyTask;

/**
 * What both kinds of task share: the timer, the soft lock of the solution and of the walkthrough,
 * and "Start fresh" on a solved task (a redo locks them again until the next pass).
 */
function wireTask(b: TaskBlock) {
  const { root } = b;
  b.timer = new Timer(root.querySelector<HTMLElement>('[data-timer]')!, b.cfg.id, b.cfg.target ?? 15);
  const unlocked = () => b.passed || (isSolved(b.cfg.id) && !b.redo) || b.timer.over;
  const focus = () => b.mount().then((e) => e.focus());
  const det = root.querySelector<HTMLDetailsElement>('[data-solution]');
  const lock = root.querySelector<HTMLElement>('[data-lock]');
  if (det && lock) softLock(det, lock, unlocked, focus);
  b.walk = walkOf(root);
  let walkLock: HTMLElement | null = null;
  if (b.walk && lock) {
    walkLock = lock.cloneNode(true) as HTMLElement;
    b.walk.after(walkLock);
    softLock(b.walk, walkLock, unlocked, focus);
  }
  root.querySelector('[data-fresh]')?.addEventListener('click', async () => {
    b.redo = true;
    b.passed = false;
    b.timer.reset();
    await b.reset();
    for (const d of [det, b.walk]) if (d) d.open = false;
    for (const l of [lock, walkLock]) if (l) l.hidden = true;
    const say = root.querySelector<HTMLElement>('[data-say]');
    if (say) say.hidden = true;
  });
}

class SqlTask extends SqlBlock {
  timer!: Timer;
  walk: HTMLDetailsElement | null = null;
  /** "Start fresh" on a solved task: the solution is locked again until the next pass. */
  redo = false;
  constructor(root: HTMLElement) {
    super(root);
    wireTask(this);
  }
  protected verdictOf(v: Verdict) {
    return taskVerdictView(v);
  }
  async run() {
    this.timer.autostart();
    await this.exec(false);
  }
  async check() {
    this.timer.autostart();
    if (!this.cfg.expected) return;
    if (await this.compare(this.cfg.expected)) {
      this.timer.pause();
      this.pass();
      const got = (this.lastOut && lastResult(this.lastOut)?.fields.map((f) => f.name)) || [];
      const spec = this.cfg.specCols ?? [];
      if (spec.length && got.join(',').toLowerCase() !== spec.join(',').toLowerCase())
        this.verdict.firstElementChild?.querySelector('.lcp-banner-body')?.append(el('div', { class: 'lcp-small', text: T.namesNote(got.join(', '), spec.join(', ')) }));
      const say = this.root.querySelector<HTMLElement>('[data-say]');
      if (say) say.hidden = false;
    }
  }
}

// ---------------------------------------------------------------- Python
class PyBlock extends Block {
  /** Runs code, streaming stdout/stderr into a console. Returns the parsed result and the text. */
  protected async exec(code: string, task: string, title?: string): Promise<{ j: any; text: string } | null> {
    if (this.busy) return null;
    const ed = await this.mount();
    const end = this.begin();
    try {
      this.verdict.replaceChildren();
      this.out.replaceChildren();
      if (!(await this.ready('python'))) return null;
      const con = el('pre', { class: 'lcp-console', hidden: true });
      this.out.append(con);
      let text = '';
      const res = await py.run(code, task, (t) => {
        text += t;
        const shown = text.replace(/^@@LC@@.*$/m, '').trimEnd();
        con.textContent = shown;
        con.hidden = !shown;
        con.scrollTop = con.scrollHeight;
      });
      this.setStatus('');
      if (res.stopped) {
        this.out.append(banner('info', T.stopped));
        return null;
      }
      if (res.timeout) {
        this.out.append(banner('fail', T.timeout(15)));
        return null;
      }
      if (res.error) {
        this.out.append(banner('fail', T.error, el('div', { class: 'lcp-mono', text: res.error })));
        return null;
      }
      const j = JSON.parse(res.json || '{}');
      if (j.error) {
        this.out.append(pyErrorView(j.error as PyErr, this.pyFile, T, (n) => ed.goLine(n), title));
        const line = userLine(j.error, this.pyFile);
        if (line) ed.markLine(line);
      }
      return { j, text };
    } finally {
      end();
    }
  }

  async run() {
    const ed = await this.mount();
    const r = await this.exec(ed.get(), this.cfg.mod ?? '');
    if (r && !r.j.error && !r.text.trim()) this.out.append(el('div', { class: 'lcp-foot', text: T.noOutput(r.j.ms ?? 0) }));
    else if (r && !r.j.error) this.out.append(el('div', { class: 'lcp-foot', text: T.done(r.j.ms ?? 0) }));
  }
}

class PyDrill extends PyBlock {
  async check() {
    const ed = await this.mount();
    const r = await this.exec(ed.get() + '\n' + (this.cfg.harness ?? ''), '');
    if (!r || r.j.error) return;
    const mark = r.text.split('\n').reverse().find((l) => l.startsWith('@@LC@@'));
    if (!mark) {
      this.verdict.replaceChildren(banner('fail', T.fail, el('div', { text: T.checksDidNotFinish })));
      return;
    }
    const checks: [boolean, string, string][] = JSON.parse(mark.slice(6));
    this.out.append(
      el(
        'ul',
        { class: 'lcp-checks' },
        checks.map(([ok, label, detail]) => el('li', { class: ok ? 'lcp-pass' : 'lcp-fail' }, el('span', { class: 'lcp-icon', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }), ' ', el('code', { text: label }), el('span', { text: ok ? ` → ${detail}` : ` — ${detail}` }))),
      ),
    );
    const passed = checks.filter((c) => c[0]).length;
    if (passed === checks.length) {
      this.verdict.replaceChildren(banner('pass', T.passPy(checks.length)));
      this.pass();
    } else this.verdict.replaceChildren(banner('fail', T.failPy(passed, checks.length)));
  }
}

class PyTask extends PyBlock {
  timer!: Timer;
  walk: HTMLDetailsElement | null = null;
  redo = false;
  constructor(root: HTMLElement) {
    super(root);
    wireTask(this);
    this.button('example')?.addEventListener('click', () => this.insertExample());
    if (this.cfg.db && !hasJspi()) this.verdict.replaceChildren(banner('info', T.jspiWarn));
  }

  async insertExample() {
    const ed = await this.mount();
    const code = ed.get();
    if (code.includes(MAIN_GUARD)) {
      this.verdict.replaceChildren(banner('info', T.exampleExists));
      return;
    }
    const body = (this.cfg.code ?? '')
      .split('\n')
      .map((l) => (l.trim() ? '    ' + l : ''))
      .join('\n');
    ed.set(code.replace(/\s*$/, '') + '\n\n\n' + MAIN_GUARD + '\n' + body + '\n');
    ed.goLine(ed.view.state.doc.lines);
    await this.run();
  }

  async run() {
    this.timer.autostart();
    await super.run();
  }

  async check() {
    this.timer.autostart();
    if (this.busy) return;
    const ed = await this.mount();
    const mod = this.cfg.mod!;
    const code = ed.get();
    const end = this.begin();
    try {
      this.verdict.replaceChildren();
      this.out.replaceChildren();
      if (!(await this.ready('python'))) return;
      this.setStatus(T.testsRun);
      const err = await py.loadTest(mod);
      if (err) {
        this.setStatus('');
        this.verdict.replaceChildren(banner('fail', T.error, el('div', { class: 'lcp-mono', text: err })));
        return;
      }
      const res = await py.check(mod, code, `test_${mod}`);
      this.setStatus('');
      if (res.stopped) return void this.verdict.replaceChildren(banner('info', T.stopped));
      if (res.timeout) return void this.verdict.replaceChildren(banner('fail', T.timeout(60)));
      if (res.error) return void this.verdict.replaceChildren(banner('fail', T.error, el('div', { class: 'lcp-mono', text: res.error })));
      const j = JSON.parse(res.json || '{}');
      if (j.out) this.out.append(el('div', { class: 'lcp-foot lcp-sub', text: T.loadOut }), el('pre', { class: 'lcp-console', text: j.out }));
      if (j.collect_error) {
        this.verdict.replaceChildren(banner('fail', T.fail, el('div', { text: T.loadError })));
        this.out.append(pyErrorView(j.collect_error, this.pyFile, T, (n) => ed.goLine(n)));
        const line = userLine(j.collect_error, this.pyFile);
        if (line) ed.markLine(line);
        return;
      }
      const rs: { name: string; status: 'pass' | 'fail' | 'skip'; error: PyErr | null; out: string; ms: number }[] = j.results ?? [];
      const nPass = rs.filter((r) => r.status === 'pass').length;
      const nFail = rs.filter((r) => r.status === 'fail').length;
      const nSkip = rs.filter((r) => r.status === 'skip').length;
      let firstFail = true;
      this.out.append(
        el(
          'ul',
          { class: 'lcp-tests' },
          rs.map((r) => {
            const icon = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✕' : '–';
            const li = el('li', { class: `lcp-${r.status === 'pass' ? 'pass' : r.status === 'fail' ? 'fail' : 'skip'}` }, el('div', { class: 'lcp-test-row' }, el('span', { class: 'lcp-icon', 'aria-hidden': 'true', text: icon }), el('code', { class: 'lcp-test-name', text: r.name }), el('span', { class: 'lcp-muted lcp-small', text: T.ms(r.ms) })));
            if (r.status === 'fail' && r.error) {
              const det = el('details', { open: firstFail }, el('summary', { text: r.error.message.split('\n')[0].slice(0, 200) }), el('pre', { class: 'lcp-trace', text: r.error.text }));
              if (r.out) det.append(el('div', { class: 'lcp-small lcp-muted', text: T.printInside }), el('pre', { class: 'lcp-console', text: r.out }));
              const line = userLine(r.error, this.pyFile);
              if (line) det.append(el('button', { type: 'button', class: 'lcp-btn lcp-btn-small', text: T.goLine(line), onclick: () => ed.goLine(line) }));
              li.append(det);
              firstFail = false;
            } else if (r.status === 'skip' && r.error) li.append(el('div', { class: 'lcp-small lcp-muted', text: `${T.skipped} ${r.error.message}` }));
            return li;
          }),
        ),
        el('div', { class: 'lcp-foot', text: `${T.tests(rs.length)} · ${T.ms(j.ms ?? 0)}` }),
      );
      const dbSkipped = rs.some((r) => r.status === 'skip' && /JSPI|database/i.test(r.error?.message ?? ''));
      if (nFail === 0 && nPass > 0 && nSkip > 0) {
        // Skipped tests are not checked tests: never mark the task solved.
        this.verdict.replaceChildren(banner('info', T.notChecked(nSkip), dbSkipped ? el('div', { class: 'lcp-small', text: T.noJspi }) : null));
      } else if (nFail === 0 && nPass > 0) {
        this.verdict.replaceChildren(banner('pass', T.passTests(nPass) + (nSkip ? T.skippedDb(nSkip) : ''), el('div', { text: T.afterPass }), dbSkipped ? el('div', { class: 'lcp-small', text: T.noJspi }) : null));
        this.timer.pause();
        this.pass();
        const say = this.root.querySelector<HTMLElement>('[data-say]');
        if (say) say.hidden = false;
      } else {
        this.verdict.replaceChildren(banner('fail', T.failTests(nPass, rs.length), el('div', { text: T.firstFail }), dbSkipped ? el('div', { class: 'lcp-small', text: T.noJspi }) : null));
      }
    } finally {
      end();
    }
  }
}

class PyPlayground extends PyBlock {
  constructor(root: HTMLElement) {
    super(root);
    if (/\bimport\s+db\b/.test(this.cfg.starter ?? '') && !hasJspi()) this.verdict.replaceChildren(banner('info', T.jspiWarn));
  }
}

// ---------------------------------------------------------------- mock interview mode
// A task page opened as /…/?mock=q05#q05 (from the mock interview page) shows only that task, and
// nothing that names its technique: no other tasks, no page title, table of contents, skill-map
// box or page links, no difficulty, notes or walkthrough. The clock is max(25, target + 10)
// minutes (lib/mock.ts) and survives a reload; the editor starts from the starter code; the
// task's questions stay hidden while the candidate types their own. The hint opens after five
// minutes; the solution and the walkthrough after a pass or when the time is up. "End the mock"
// brings everything back, shows the task's questions to tick and the self-review checklist.
const mockPage = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${isRu ? 'ru/' : ''}start/mock-interview/`;
const askedKey = (id: string) => `lcm-mock-asked:${id}`;
const mockDraftKey = (id: string) => `lcm-mock-draft:${id}`;

/** "Ask first" in a mock: the candidate types their own questions; the task's list opens later, to tick. */
function mockAsk(b: TaskBlock): () => void {
  const box = b.root.querySelector<HTMLElement>('[data-ask]');
  const mine = box?.querySelector<HTMLElement>('[data-ask-mine]');
  const list = box?.querySelector<HTMLElement>('[data-ask-list]');
  if (!box || !mine || !list) return () => {};
  const notes = mine.querySelector<HTMLTextAreaElement>('[data-ask-notes]')!;
  const show = mine.querySelector<HTMLButtonElement>('[data-ask-show]')!;
  const score = mine.querySelector<HTMLElement>('[data-ask-score]')!;
  mine.hidden = false;
  notes.value = session.get(askedKey(b.cfg.id)) ?? '';
  notes.addEventListener('input', () => session.set(askedKey(b.cfg.id), notes.value || null));
  const reveal = () => {
    if (list.classList.contains('lcp-mock-unlocked')) return;
    list.classList.add('lcp-mock-unlocked');
    show.hidden = true;
    const how = mine.querySelector<HTMLElement>('p');
    if (how) how.hidden = true;
    const ticks = [...list.querySelectorAll<HTMLLIElement>(':scope > li')].map((li) => {
      const input = el('input', { type: 'checkbox', 'data-ask-tick': '' });
      li.append(el('label', { class: 'lcp-ask-tick' }, input, el('span', { text: T.askTick })));
      return input;
    });
    const update = () => (score.textContent = T.askScore(ticks.filter((t) => t.checked).length, ticks.length));
    for (const t of ticks) t.addEventListener('change', update);
    update();
    score.hidden = false;
  };
  show.addEventListener('click', reveal);
  return reveal;
}

/** The self-review at the end of a mock: the time it took and the checklist, ticked by the candidate. */
function reviewView(used: number, mins: number, actions: HTMLElement[]): HTMLElement {
  const boxes = T.mockChecklist.map(() => el('input', { type: 'checkbox' }));
  const count = el('div', { class: 'lcp-small lcp-muted', 'data-review-count': '' });
  const update = () => (count.textContent = T.mockTicked(boxes.filter((x) => x.checked).length, boxes.length));
  for (const x of boxes) x.addEventListener('change', update);
  update();
  return el(
    'div',
    { class: 'lcp-banner lcp-review', role: 'status' },
    el(
      'div',
      { class: 'lcp-banner-body' },
      el('strong', { text: T.mockReview }),
      el('div', { text: T.mockTime(clock(used), mins) }),
      el('ul', { class: 'lcp-checklist' }, T.mockChecklist.map((t, i) => el('li', null, el('label', null, boxes[i], el('span', { text: t }))))),
      count,
      el('div', { class: 'lcp-bar' }, actions),
    ),
  );
}

function setupMock(blocks: Block[]) {
  const id = new URLSearchParams(location.search).get('mock');
  if (!id) return;
  const b = blocks.find((x) => x.cfg.id === id && (x instanceof SqlTask || x instanceof PyTask)) as TaskBlock | undefined;
  const content = b?.root.closest('.sl-markdown-content');
  if (!b || !content) return;
  const top = [...content.children].find((c) => c.contains(b.root)) as HTMLElement | undefined;
  if (!top) return;
  const html = document.documentElement;
  mockActive = true;
  html.classList.add('lcp-mock');
  top.classList.add('lcp-mock-keep');
  b.root.classList.add('lcp-mock-task');
  b.redo = true;
  b.syncSolved();
  for (const d of b.root.querySelectorAll<HTMLDetailsElement>('details[data-solution], details[data-hint], [data-ask-list] details')) d.open = false;

  // Outside the task: the page title (heading and browser tab) and the current page in the sidebar
  // name the technique. The table of contents, the skill-map box and the page links go by CSS.
  const titlePanel = document.querySelector('h1#_top')?.closest('.content-panel');
  titlePanel?.classList.add('lcp-mock-off');
  const current = [...document.querySelectorAll<HTMLElement>('nav.sidebar [aria-current="page"]')];
  for (const a of current) a.removeAttribute('aria-current');
  const pageTitle = document.title;
  document.title = pageTitle.includes(' | ') ? `${T.mockTitle} | ${pageTitle.split(' | ').pop()}` : T.mockTitle;

  // The plan: the queue from the picker, or this task alone when the link was opened directly.
  const mins = mockMinutes(b.cfg.target ?? 20);
  const found = readMock();
  const plan: MockPlan = found && found.queue[0]?.id === id ? found : { queue: [{ id, url: `${location.pathname}${location.search}#${id}`, mins }], back: '', count: 1, total: mins };
  const count = plan.count || plan.queue.length;
  const total = plan.total || mins;
  const k = count - plan.queue.length + 1;

  // The clock, resumed after a reload. One left running for hours belongs to an abandoned mock.
  const saved = plan.clock?.[id] ?? null;
  const state = saved && !(saved.running && Date.now() - saved.since > (mins + 60) * 60_000) ? saved : null;
  if (!state) {
    session.set(mockDraftKey(id), null);
    session.set(askedKey(id), null);
  }
  writeMock(plan);
  b.timer.mock(state, mins, (c) => {
    const p = readMock() ?? plan;
    writeMock({ ...p, clock: { ...p.clock, [id]: c } });
  });

  // The editor starts from the starter code; the reader's saved draft is one click away.
  b.mockDrafts(true);
  if (b.editor) b.editor.set(session.get(mockDraftKey(id)) ?? b.cfg.starter ?? '');
  const draft = b.savedDraft();
  const restore = draft ? el('button', { type: 'button', class: 'lcp-btn', 'data-mock-restore': '', text: T.mockRestore }) : null;
  if (restore)
    restore.addEventListener('click', async () => {
      (await b.mount()).set(draft!);
      restore.remove();
    });
  const revealAsk = mockAsk(b);

  const note = el('div', { class: 'lcp-small', hidden: true, text: T.mockOver });
  const endBtn = el('button', { type: 'button', class: 'lcp-btn lcp-btn-primary', 'data-mock-end': '', text: T.mockEnd });
  const bar = el(
    'div',
    { class: 'lcp-mock-bar not-content lcp-mock-keep', 'data-mock-bar': '' },
    banner('info', T.mockTitle, el('div', { 'data-mock-clock': '', text: count > 1 ? T.mockClockOf(mins, k, count, total) : T.mockClock(mins) }), el('div', { text: T.mockHow }), note, el('div', { class: 'lcp-bar' }, endBtn, restore)),
  );
  top.before(bar);
  requestAnimationFrame(() => bar.scrollIntoView({ block: 'start' }));

  const unlock = (what: 'hint' | 'all') => {
    b.root.querySelector('[data-hint]')?.classList.add('lcp-mock-unlocked');
    if (what === 'all') {
      b.root.querySelector('[data-solution]')?.classList.add('lcp-mock-unlocked');
      b.walk?.classList.add('lcp-mock-keep');
    }
  };
  const step = () => {
    if (b.timer.seconds >= 300) unlock('hint');
    // The mock clock stops only on a pass (Pause is hidden), also before a reload.
    if (b.passed || b.timer.over || !b.timer.running) unlock('all');
    note.hidden = !b.timer.over;
  };
  step();
  const tick = setInterval(step, 1000);

  endBtn.addEventListener('click', () => {
    clearInterval(tick);
    const used = b.timer.seconds;
    b.timer.endMock();
    mockActive = false;
    html.classList.remove('lcp-mock');
    titlePanel?.classList.remove('lcp-mock-off');
    for (const a of current) a.setAttribute('aria-current', 'page');
    document.title = pageTitle;
    b.mockDrafts(false);
    b.syncSolved();
    revealAsk();
    // A reload now shows the normal page.
    history.replaceState(history.state, '', `${location.pathname}${location.hash}`);
    const rest = plan.queue.filter((q) => q.id !== id);
    if (rest.length) writeMock({ ...(readMock() ?? plan), queue: rest });
    else writeMock(null);
    const actions: HTMLElement[] = [];
    if (rest.length) actions.push(el('a', { class: 'lcp-btn lcp-btn-primary', href: rest[0].url, text: T.mockNext }));
    actions.push(el('a', { class: 'lcp-btn', href: plan.back || mockPage, text: T.mockAgain }));
    bar.replaceChildren(reviewView(used, mins, actions));
    bar.scrollIntoView({ block: 'start' });
  });
}

// ---------------------------------------------------------------- wiring
const KINDS: Record<string, new (root: HTMLElement) => Block> = {
  'drill-sql': SqlBlock,
  trap: TrapBlock,
  'task-sql': SqlTask,
  'playground-sql': SqlBlock,
  'drill-py': PyDrill,
  'task-py': PyTask,
  'playground-py': PyPlayground,
};

function init() {
  const blocks: Block[] = [];
  document.querySelectorAll<HTMLElement>('[data-lcp]').forEach((root) => {
    if (root.dataset.lcpReady) return;
    root.dataset.lcpReady = '1';
    const K = KINDS[root.dataset.lcp ?? ''];
    if (!K) return;
    const b = new K(root);
    // A handle for tests and for debugging in the console: $0.lcpBlock.editor.get()
    (root as any).lcpBlock = b;
    blocks.push(b);
  });
  // Editors are created when their block comes near the viewport.
  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              io!.unobserve(e.target);
              blocks.find((b) => b.host === e.target)?.mount();
            }
          },
          { rootMargin: '600px 0px' },
        )
      : null;
  for (const b of blocks) {
    if (io) io.observe(b.host);
    else b.mount();
  }
  setupMock(blocks);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

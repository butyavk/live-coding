// Small DOM helpers and the result views shared by the practice components (browser only).
import type { Strings } from './i18n';
import type { SqlRun } from './runtime';
import type { Verdict } from './compare';

type Kid = Node | string | null | undefined | false | Kid[];
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, any> | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') n.textContent = String(v);
    else if (k === 'class') n.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (k: Kid) => {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else n.append(k);
  };
  kids.forEach(add);
  return n;
}

const NUMERIC = new Set([20, 21, 23, 26, 700, 701, 1700]);
export function cellText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** A result table inside its own horizontal scroller. */
export function table(cols: { name: string; typeId?: number }[], rows: unknown[][], max = 100, mark?: number): HTMLElement {
  const tb = el('tbody');
  const numeric = cols.map((c, j) => NUMERIC.has(c.typeId ?? -1) || (rows.some((r) => typeof r[j] === 'number') && rows.every((r) => r[j] === null || typeof r[j] === 'number')));
  rows.slice(0, max).forEach((r, i) => {
    tb.append(
      el(
        'tr',
        { class: mark === i ? 'lcp-row-mark' : null },
        r.map((v, j) => {
          const s = cellText(v);
          const num = typeof v === 'number' || numeric[j];
          return el('td', { class: num ? 'lcp-num' : null }, s === null ? el('span', { class: 'lcp-null', text: 'NULL' }) : s);
        }),
      ),
    );
  });
  return el('div', { class: 'lcp-scroll' }, el('table', { class: 'lcp-table' }, el('thead', null, el('tr', null, cols.map((c, j) => el('th', { class: numeric[j] ? 'lcp-num' : null, text: c.name })))), tb));
}

/** Line and column of a 1-based character position in `text`. */
export function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, Math.max(0, pos - 1)).split('\n');
  return { line: before.length, col: before[before.length - 1].length + 1 };
}

export function banner(kind: 'pass' | 'fail' | 'info', title: string, ...rest: Kid[]): HTMLElement {
  const icon = kind === 'pass' ? '✓' : kind === 'fail' ? '✕' : '↻';
  return el('div', { class: `lcp-banner lcp-${kind}`, role: kind === 'fail' ? 'alert' : 'status' }, el('span', { class: 'lcp-icon', 'aria-hidden': 'true', text: icon }), el('div', { class: 'lcp-banner-body' }, el('strong', { text: title }), rest));
}

export function verdictView(v: Verdict, T: Strings): HTMLElement {
  if (v.ok) return banner('pass', T.pass);
  const extra: Kid[] = [el('div', { text: v.msg ?? '' })];
  if (v.exp || v.got) {
    extra.push(el('pre', { class: 'lcp-diff', text: `${T.expectedLabel}: ${JSON.stringify(v.exp ?? null)}\n${T.yoursLabel}:${' '.repeat(Math.max(1, T.expectedLabel.length - T.yoursLabel.length + 1))}${JSON.stringify(v.got ?? null)}` }));
  }
  if (v.missing?.length) extra.push(el('div', { class: 'lcp-small', text: `${T.missingEx} ${v.missing.map((r) => JSON.stringify(r)).join('; ')}` }));
  if (v.extra?.length) extra.push(el('div', { class: 'lcp-small', text: `${T.extraEx} ${v.extra.map((r) => JSON.stringify(r)).join('; ')}` }));
  return banner('fail', T.fail, extra);
}

/** Renders a SQL run: every result set, or the error with its line. Returns the error line, if any. */
export function sqlRunView(box: HTMLElement, out: SqlRun, sql: string, lineOffset: number, T: Strings): number | null {
  box.replaceChildren();
  if (out.stopped) {
    box.append(banner('info', T.stopped));
    return null;
  }
  if (out.timeout) {
    box.append(banner('fail', T.timeout(20)));
    return null;
  }
  if (out.error) {
    const e = out.error;
    let line: number | null = null;
    let title = T.error;
    if (e.position) {
      const lc = lineCol(sql, e.position);
      line = lc.line + lineOffset;
      title = T.errorAt(line, lc.col);
    }
    box.append(
      banner(
        'fail',
        title,
        el('div', { class: 'lcp-mono', text: e.message }),
        e.detail ? el('div', { class: 'lcp-mono lcp-small', text: `DETAIL: ${e.detail}` }) : null,
        e.hint ? el('div', { class: 'lcp-mono lcp-small', text: `HINT: ${e.hint}` }) : null,
      ),
    );
    return line;
  }
  const shown = out.results.filter((r) => r.fields.length);
  if (!out.results.length) {
    box.append(el('div', { class: 'lcp-foot', text: T.nothingToRun }));
    return null;
  }
  if (!shown.length) {
    box.append(el('div', { class: 'lcp-foot', text: `${T.noRows} · ${T.ms(out.ms)}` }));
    return null;
  }
  shown.forEach((r, k) => {
    if (shown.length > 1) box.append(el('div', { class: 'lcp-foot lcp-sub', text: T.resultOf(k + 1, shown.length) }));
    box.append(table(r.fields, r.rows));
    const n = r.rows.length;
    box.append(el('div', { class: 'lcp-foot', text: `${T.rows(n)}${n > 100 ? ` (${T.shownFirst(100)})` : ''} · ${T.ms(out.ms)}` }));
  });
  return null;
}

/** The last result set that has columns (what Check compares). */
export const lastResult = (out: SqlRun) => [...out.results].reverse().find((r) => r.fields.length) ?? null;

export interface PyErr {
  type: string;
  message: string;
  frames: { file: string; line: number; name: string; code: string }[];
  text: string;
}
/** The last frame of the user's own file: the line to show. */
export const userLine = (err: PyErr | null | undefined, file: string) => {
  const fr = (err?.frames ?? []).filter((f) => f.file === file);
  return fr.length ? fr[fr.length - 1].line : null;
};

export function pyErrorView(err: PyErr, file: string, T: Strings, goLine?: (n: number) => void, title?: string): HTMLElement {
  const line = userLine(err, file);
  return banner(
    'fail',
    title ?? (line ? T.errorLine(line) : T.error),
    el('pre', { class: 'lcp-trace', text: err.text || err.message }),
    line && goLine ? el('button', { type: 'button', class: 'lcp-btn lcp-btn-small', text: T.goLine(line), onclick: () => goLine(line) }) : null,
  );
}

/** Copies text with a short "Copied" note on the button. */
export async function copyText(btn: HTMLButtonElement, text: string, T: Strings) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = el('textarea', { class: 'lcp-offscreen' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* nothing else to try */
    }
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = T.copied;
  setTimeout(() => (btn.textContent = old), 1200);
}

// Compares a result set from the browser with the reference recorded at build time.
// Values are normalised the same way on both sides (src/runtime/pg-setup.js): numbers rounded
// to three decimals, booleans and everything else as text. Column names are ignored unless the
// task fixes them (`names`), and row order matters only when the answer is ordered.
import { normRows } from '~/runtime/pg-setup.js';
import type { Strings } from './i18n';

export type Cell = string | number | null;
export interface Field {
  name: string;
  typeId: number;
}
export interface ResultSet {
  fields: Field[];
  rows: unknown[][];
}
export interface ExpectedSet {
  cols: string[];
  rows: Cell[][];
}
export interface Verdict {
  ok: boolean;
  msg?: string;
  /** First differing row on each side (1-based index in `row`). */
  exp?: Cell[];
  got?: Cell[];
  row?: number;
  col?: number;
  missing?: Cell[][];
  extra?: Cell[][];
  /** Columns whose values differ, whatever the row order (same row count only, not every column). */
  diffCols?: string[];
  /** What kind of difference the first differing value is (a key of `T.diffKind`). */
  kind?: string;
}

const J = (x: unknown) => JSON.stringify(x);
const keyOf = (rows: Cell[][]) => rows.map(J).sort().join('\n');
const sortRows = (rows: Cell[][]) => [...rows].sort((a, b) => (J(a) < J(b) ? -1 : J(a) > J(b) ? 1 : 0));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STAMP = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}(:?\d{2})?)?$/;
const DATEISH = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([+-]\d{2}(:?\d{2})?)?)?$/;
const has = (rows: Cell[][], j: number, re: RegExp) => rows.some((r) => typeof r[j] === 'string' && re.test(r[j] as string));
const all = (rows: Cell[][], j: number, re: RegExp) => rows.every((r) => r[j] === null || (typeof r[j] === 'string' && re.test(r[j] as string)));
/** Only dates in column j. */
const days = (rows: Cell[][], j: number) => has(rows, j, DAY) && all(rows, j, DAY);
/** Dates and timestamps in column j, at least one with a time of day. */
const times = (rows: Cell[][], j: number) => has(rows, j, STAMP) && all(rows, j, DATEISH);
/**
 * Columns that hold dates on one side and timestamps on the other, compared as days. Null when
 * there is no such column. Values that already match never get here, so this only explains a
 * real difference: a timestamp with a time of day where a date is expected, or the other way round.
 */
function asDays(g: Cell[][], e: Cell[][]): [Cell[][], Cell[][]] | null {
  const n = e[0]?.length ?? 0;
  const cols: number[] = [];
  for (let j = 0; j < n; j++) {
    if ((days(e, j) && times(g, j)) || (days(g, j) && times(e, j))) cols.push(j);
  }
  if (!cols.length) return null;
  const day = (rows: Cell[][]) => rows.map((r) => r.map((v, j) => (cols.includes(j) && typeof v === 'string' ? (STAMP.exec(v)?.[1] ?? v) : v)));
  return [day(g), day(e)];
}
const keyCol = (rows: Cell[][], j: number) => rows.map((r) => J(r[j])).sort().join('\n');
const isDate = (v: Cell) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
/** The kind of difference between an expected and a returned value, without the values. */
function kindOf(exp: Cell | undefined, got: Cell | undefined): string | undefined {
  if (exp === undefined || got === undefined) return undefined;
  if (got === null) return 'nullGot';
  if (exp === null) return 'nullExp';
  if (typeof exp !== typeof got) return 'type';
  if (typeof exp === 'number') return 'number';
  return isDate(exp) && isDate(got) ? 'date' : 'text';
}
const roundTo = (rows: Cell[][], d: number) => rows.map((r) => r.map((v) => (typeof v === 'number' ? Math.round(v * 10 ** d) / 10 ** d : v)));

/** Rows of `a` that are not in `b` (as a multiset), at most `max`. */
function minus(a: Cell[][], b: Cell[][], max = 3): Cell[][] {
  const left = new Map<string, number>();
  for (const r of b) left.set(J(r), (left.get(J(r)) ?? 0) + 1);
  const out: Cell[][] = [];
  for (const r of a) {
    const k = J(r);
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else if (out.length < max) out.push(r);
  }
  return out;
}

export function compareResult(got: ResultSet, exp: ExpectedSet, opts: { ordered: boolean; names?: boolean }, T: Strings): Verdict {
  const gotNames = got.fields.map((f) => f.name.toLowerCase());
  if (opts.names && gotNames.join(',') !== exp.cols.join(',')) {
    return { ok: false, msg: T.colNames(exp.cols.join(', '), gotNames.join(', ') || '—') };
  }
  if (got.fields.length !== exp.cols.length) return { ok: false, msg: T.cols(got.fields.length, exp.cols.length, exp.cols.join(', ')) };

  const g = normRows(got.rows, got.fields.map((f) => f.typeId)) as Cell[][];
  const e = exp.rows;
  if (J(g) === J(e)) return { ok: true };
  if (g.length === e.length && keyOf(g) === keyOf(e)) return opts.ordered ? { ok: false, msg: T.order } : { ok: true };
  const byDay = g.length === e.length ? asDays(g, e) : null;
  if (byDay && keyOf(byDay[0]) === keyOf(byDay[1])) return { ok: false, msg: T.dateType };
  if (g.length === e.length && [0, 1, 2].some((d) => keyOf(roundTo(g, d)) === keyOf(roundTo(e, d)))) return { ok: false, msg: T.numType };

  const gs = opts.ordered ? g : sortRows(g);
  const es = opts.ordered ? e : sortRows(e);
  let msg = e.length === g.length ? T.sameCount(g.length) : T.rowCount(e.length, g.length);
  const v: Verdict = { ok: false };
  let i = 0;
  while (i < Math.min(gs.length, es.length) && J(gs[i]) === J(es[i])) i++;
  if (i < Math.min(gs.length, es.length)) {
    const col = es[i].findIndex((x, j) => J(x) !== J(gs[i][j]));
    msg += col >= 0 && (opts.ordered || e.length === 1) ? T.firstDiffCol(i + 1, exp.cols[col] ?? String(col + 1)) : es.length > 1 ? T.firstDiff(i + 1, !opts.ordered) : '';
    Object.assign(v, { exp: es[i], got: gs[i], row: i + 1, col: col >= 0 ? col : undefined });
  } else if (g.length < e.length) msg += ' ' + T.missingRows;
  else msg += ' ' + T.extraRows;
  if (e.length !== g.length) {
    v.missing = minus(e, g);
    v.extra = minus(g, e);
  } else {
    // Where the values differ, whatever the order: the columns, and the kind of the difference.
    const bad = exp.cols.map((_, j) => j).filter((j) => keyCol(g, j) !== keyCol(e, j));
    if (bad.length && bad.length < exp.cols.length) v.diffCols = bad.map((j) => exp.cols[j] ?? String(j + 1));
    if (v.col !== undefined && (opts.ordered || e.length === 1)) v.kind = kindOf(v.exp?.[v.col], v.got?.[v.col]);
    else if (bad.length === 1) {
      const j = bad[0];
      const one = (rows: Cell[][]) => rows.map((r) => [r[j]]);
      v.kind = kindOf(minus(one(e), one(g), 1)[0]?.[0], minus(one(g), one(e), 1)[0]?.[0]);
    }
  }
  v.msg = msg;
  return v;
}

/** What the build recorded for the hidden edge-case data: counts and a fingerprint, no rows. */
export interface EdgeExpected {
  n: number;
  cols: number;
  hash: string;
}

/** The same fingerprint as scripts/build-exercises.mjs: SHA-256 of the sorted, normalised rows. */
export async function edgePrint(got: ResultSet): Promise<EdgeExpected> {
  const rows = normRows(got.rows, got.fields.map((f) => f.typeId)) as Cell[][];
  const text = rows.map((r) => JSON.stringify(r)).sort().join('\n');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { n: rows.length, cols: got.fields.length, hash };
}

/** null when the answer also matches on the edge-case data, else a message without the hidden rows. */
export function compareEdge(got: EdgeExpected, exp: EdgeExpected, T: Strings): string | null {
  if (got.hash === exp.hash && got.n === exp.n && got.cols === exp.cols) return null;
  if (got.cols !== exp.cols) return T.edgeCols(exp.cols, got.cols);
  if (got.n !== exp.n) return T.edgeRows(exp.n, got.n);
  return T.edgeValues(exp.n);
}

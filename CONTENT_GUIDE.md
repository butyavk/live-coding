# Content guide

How pages on this site are written. Follow it for every new or edited page so the English
and Russian versions stay consistent and the build keeps passing.

## 1. Goal and audience

Readers are engineers preparing for a **live-coding interview**: SQL and Python, solved on a
shared screen (a shared online editor, a plain editor or a notebook), out loud, in 25–60 minutes, usually
without AI and with the documentation allowed. The site teaches the patterns these tasks are
built from, the traps interviewers watch for, and a protocol for the hour itself. Every
exercise runs in the browser on a real PostgreSQL and a real CPython.

Every page should be:

- **Practical.** Each idea comes with a query or a function that runs on the practice
  dataset, and every number in the text comes from a real run (see §10).
- **Written in our own words.** Do not paste sentences from documentation, books or blogs.
  A quote, if ever needed, stays under 15 words, in quotation marks, with attribution.
- **Scannable.** Short paragraphs, informative headings, tables for comparisons.
- **Interview-oriented.** Every topic page ends with what to say out loud and the follow-up
  question that usually comes next.
- **Neutral.** No real company names at all: not as the source of a task, not as an example of
  how some company interviews, not in the dataset. Interview tools are "a shared online
  editor". Technology names (PostgreSQL, Python, DuckDB, MySQL…) are fine. No interviewer or
  candidate names, no personal stories ("in my interview…", "my mock"). The dataset is an
  invented subscription marketplace (merchants, products, plans, customers, two invented
  partner marketplaces, web checkout, promo access, an advances program); keep it that way.
- **British spelling in English** (practise as a verb, behaviour, -ise), except names that
  are spelled otherwise in their standards and products (`serializable`, `ROUND_HALF_UP`).
- **Plain English.** Short sentences (12–15 words on average), common words, no idioms. The
  readers include many non-native speakers; the phrases they practise here must be easy to say.

## 2. Files and frontmatter

- English: `src/content/docs/<section>/<slug>.mdx`
- Russian: `src/content/docs/ru/<section>/<slug>.mdx` — same slug, same file name.
- Sections and slugs live in `scripts/pages.json`, in sidebar order. Do not invent slugs
  without adding them there.
- Every page except `about/` and the map itself is a node on the skill map
  (`src/data/skill-map.ts`) with its direct prerequisites. The build fails if a page is missing
  from the map, a prerequisite does not exist, the graph has a cycle, a study-plan step is not on
  the map, a page in a study-plan timeline (`src/data/study-plan.ts`) needs a page outside that
  timeline (an optional step: a page the timeline does not show), or a timeline lists a page
  before one of its prerequisites. The study plan and the map share one choice of plan and one
  progress, so the map's "Next up" follows the plan's order.

```yaml
---
title: LEFT JOIN and zeros                # short, sentence case, in the page language
description: One sentence, 120–160 characters, used for search and link previews.
sidebar:
  order: 6                                # position in the section = index in pages.json + 1
---
```

## 3. Topic page template (`sql/`, `sql-patterns/`, `python/`)

```mdx
---
(frontmatter)
---
import { Aside } from '@astrojs/starlight/components';
import Drill from '~/components/practice/Drill.astro';
import Trap from '~/components/practice/Trap.astro';
import Talk from '~/components/practice/Talk.astro';

Two or three sentences: which interview tasks need this, and what goes wrong without it.

<Aside type="tip" title="TL;DR">
- 3–5 bullets: the recipe lines a reader can copy onto a sheet of paper.
</Aside>

## Sections with H2 headings (H3 for subsections)

The idea, then a short query or function on the practice data, then its real output as a
Markdown table (a few rows). Traps sit next to the idea they break.

<Trap id="left-where" q="…the question, in the page language…">
…the answer, in the page language…
</Trap>

## Practice

<Drill id="s-left-zero">
…why the reference is written this way: the step that matters, the trap it avoids…
</Drill>

<Aside type="note" title="In the interview">
What to say out loud (an English sentence in quotes), the usual follow-up question, and the
mistake interviewers watch for.
</Aside>

## Further reading
- 2–5 links, official documentation first (PostgreSQL, Python), see §8.

## Related topics
- [Row multiplication](/sql-patterns/row-multiplication/) — one line on why it is related.
```

Russian headings of the fixed blocks: `TL;DR` → `Коротко`, `Practice` → `Практика`,
`In the interview` → `На интервью`, `Further reading` → `Что почитать`,
`Related topics` → `Связанные темы`.

Length (prose, without code): topic pages ≈ 700–1,500 words. Practice is the point;
an explanation that the exercises already show can be short.

## 4. Task page template (`sql-tasks/`, `python-tasks/`)

```mdx
import { Aside } from '@astrojs/starlight/components';
import Task from '~/components/practice/Task.astro';
import Reveal from '~/components/practice/Reveal.astro';

Two or three sentences: what these tasks have in common and which pages they build on.

<Aside type="tip" title="How to practise">
Timer on, out loud, the [protocol](/start/interview-protocol/): restate, ask, plan, small
steps, check before "done". Open the walkthrough only after Check passes.
</Aside>

## Q01. Revenue by channel

<Task id="q01" />

<Reveal title="Walkthrough" try>
**What it is for.** …  **Steps.** …  **Traps.** …  **Check.** …  **Follow-up.** …
**In production.** which index or table design would serve this query.
</Reveal>
```

The task statement, the questions to ask, the data notes, the editor, Check and the
reference solution all come from `<Task>`; the page adds the walkthrough. Headings use the
task id and its English title, in both languages (`## Q01. Revenue by channel`).

## 5. Practice components

Import them from `~/components/practice/`. Every id must exist in `src/data/practice/` and
be placed exactly once in the English pages and once in the Russian ones
(`npm run check:content` checks both).

| Component | Use | Content (children) |
|---|---|---|
| `<Drill id="…">` | SQL drill (`s-…`) or Python drill (`y-…`): the task in English, the output columns (and the `ORDER BY` when the order is checked), an editor, Run, Check against the reference, Show answer | The explanation, shown with the reference |
| `<Trap id="…" q="…">` | A short query that looks right and is not: guess, run, then fix it | The answer, shown after Run or Show answer |
| `<Talk q="…">` | A question to answer out loud, no code | The spoken answer (English, in quotes) and an optional note |
| `<Task id="q01" />` | A full interview task (SQL `q…`/`d01`, Python `p…`/`d0…`): difficulty, target time, timer, questions to ask, notes about the data (collapsed), editor, Check, hint, soft-locked solution; it also soft-locks its walkthrough | none |
| `<Reveal title="…" try>` | A block hidden until clicked; `try` adds "try the task first" | Any Markdown |
| `<Playground lang="sql" code="…" />` | A free editor with Run (`sql` or `python`) | none |
| `<MockInterview />` | The mock interview picker (`start/mock-interview`): SQL, Python or both; picks a random task from the pages of the reader's study plan ("Any task" lifts this filter), unsolved ones first, and opens it in mock mode | none |
| `<MockInterview review />` | The self-review checklist, the same list the end of a mock shows | none |

- The task text of drills and tasks is English in both languages: it is what the
  interviewer says. Explanations, answers and notes are in the page language.
- `q` on `<Trap>` is in the page language; `q` on `<Talk>` is the interviewer's question in
  English on both pages. Use `q={"…"}` when the text contains double quotes.
- In `<Talk>` the spoken answer stays English on the Russian page too (that is what the
  reader practises saying); the note after it is Russian.
- Children are Markdown: leave a blank line after the opening tag and before the closing
  tag, otherwise lists and code blocks inside are not parsed.

**Hidden edge-case data.** Check runs a SQL answer (drill, trap fix, task) on the practice data
and then on a hidden copy of it, `src/runtime/edge.sql`: a day with no activity (12 Sep 2026),
a quiet month for one merchant (mer_05, August 2026, with a refund and a payout but no sales),
both edges of August (sales during 31 August, one half a second before midnight, one exactly at
1 September 00:00), periods that end or are refunded exactly at a boundary, ties on `start_time`
and across the edge of a top 5, two plans bought at the same moment, one customer with two
subscriptions to one product, webhook copies that arrive after midnight, a refund that moves an
advance limit, a repayment exactly at "today", a payout nobody expected, a payout sent twice, a
payout exactly 1.00 off, an advance for a merchant who is not enrolled, two merchants with the
same name, and rows for the typical mistakes in drills and trap fixes (section D of the file).
Both runs must match the reference. The hidden result is compared as a set of rows (the order
is checked on the practice data only), and the hidden rows are never shown: the message gives
only the expected number of columns or rows, or says that values differ. So a page never says "the data cannot show this": write "Check also runs your query on
hidden edge-case data, so a missing calendar fails there." An exercise whose reference builds
its own tables (`CREATE`, `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `EXPLAIN`) is checked
on the practice data only. Offline, `exercises/tests/test_sql.py` does the same with DuckDB, and
`node scripts/check-answer.mjs <id> <file>` checks one answer the way the site does.

**How Check compares SQL.** Column names are not checked: the values, the number of columns and
rows (and the order, when it is checked) are. A task whose column names differ from the spec
passes with a note. Numbers are compared rounded to three decimals, and a timestamp exactly at
midnight counts as its date, so `date_trunc('month', …)` matches a `DATE` column. A timestamp
with a time of day where a date is expected (or the other way round), or numbers that differ
only in rounding, fail with a message that says so. A failed drill or trap shows the expected
values. A failed task shows where the difference is (the row count, the column, the row) and
its kind, but not the expected value: outside a mock it sits behind "Show the expected value",
in a mock it is never shown.

**How Check compares Python drills.** Each test's result must equal the expected value and have
the same type all the way down, inside lists, tuples, dicts and dataclasses: `1.0` is not `1`,
a `defaultdict` is not a `dict`, a tuple is not a list. With `scale: true` every `Decimal` must
also have the same number of decimal places (`12.5` is not `12.50`); use it only when the
question fixes the scale. The failure message names the first difference and says when only the
type or the scale differs. Python tasks are checked by their pytest file.

**Hints** live in `src/data/practice/hints.ts`: `taskHints: Record<task id, { en, ru }>`, one
nudge per task, the way an interviewer would unblock a candidate, never the solution. Shown
behind a "Hint" toggle under the task (in a mock, only after five minutes). A Python task
without an entry falls back to the hint in its docstring.

**Russian translations** live in `src/data/practice/translations-ru.ts`: `ruText: Record<id,
{ q?, task?, bug?, should?, brief?, example?, ask? }>` (`q` for drills; the others for tasks;
`ask` follows the order of the task's questions, `{ q, a }`). Russian pages show them behind
«Перевод»; the English text stays the main one.

`npm run exercises` validates both files: an unknown id, or a hint without `en` or `ru`, fails
the build; tasks and drills without an entry are listed as warnings. Keep both files free of
imports and of non-erasable TypeScript.

**Mock mode.** A mock runs on the task's mock page, `/mock/<id>/` and `/ru/mock/<id>/`
(`src/pages/mock/`, `MockPage.astro`; the picker links there): the task alone, on an address and
under a title ("Mock interview") that name no topic, because a real interviewer never says which
pattern a task belongs to. Every task placed on a page gets one; nothing to add by hand. The
mock pages have no sidebar entry and stay out of the site search and the sitemap (`noindex`).
While the mock runs, nothing in the task names its technique either: no difficulty, target time
or notes about the data. Old links to a topic page with `?mock=<id>` go to the mock page. Drafts
and the solved state use the same keys as on the topic page, so a pass in a mock counts on the
plan and the map.

| In a mock | What happens |
|---|---|
| Clock | `max(25, target + 10)` minutes (`lib/mock.ts`); "both" gets the sum of its two tasks. Starts at once, has no pause or reset, stops only on a pass, and survives a reload (`sessionStorage`) |
| Editor | Starts from the starter code, not from the reader's draft; "Restore my draft" brings the draft back. The mock's code is kept for this tab only |
| Questions | The candidate types their own under "Your questions". The task's list stays hidden until "Show the questions" or the end of the mock; then each question gets an "I asked this" box and a score |
| Hint | Opens after five minutes |
| Solution | Opens after Check passes or the time is up |
| Failed Check | Shows where the difference is, never the expected value |
| "End the mock" | Brings the task's labels back and shows the time used, the self-review checklist, "Open the walkthrough" (the task on its topic page, in a new tab), "Another mock" and, in a mock of both kinds, "Next task". A reload after that shows the self-review again |

The walkthrough is the first `<Reveal>` after the `<Task>` and before the next heading or
exercise. It is soft-locked like the solution: one click once Check has passed or the target
time is up, otherwise a confirm step. So keep each walkthrough right after its task.

## 6. Russian version

- Natural technical Russian, not a word-for-word translation. Same structure, same order of
  headings, same code (comments translated), same exercises.
- Address the reader as «вы» or write impersonally; never «ты».
- No anglicisms where a standard Russian term exists, but give the English term in
  parentheses on first use when engineers search for it.
- «ё» where it matters (ещё, всё), quotes «ёлочки», em dash —.
- Numbers in prose: `1 000 000`, decimal comma (`2,5 %`); code and query output stay as is.

| EN | RU |
|---|---|
| live coding | лайвкодинг |
| interview / interviewer | интервью / интервьюер |
| query | запрос |
| row / column / table | строка / колонка / таблица |
| join | соединение (JOIN) |
| row multiplication (fan-out) | размножение строк |
| window function | оконная функция |
| half-open interval | полуоткрытый интервал |
| subscription / renewal / trial | подписка / продление / триал |
| merchant | продавец (merchant) |
| product / plan | продукт / тариф (plan) |
| sales channel / partner marketplace | канал продаж / маркетплейс-партнёр |
| web checkout / promo access | оплата на сайте / промо-доступ |
| test purchase | тестовая покупка |
| refund | возврат |
| revenue (gross / net) | выручка (gross / net) |
| advance | аванс |
| ledger | журнал проводок (ledger) |
| payout | выплата |
| reconciliation | сверка |
| duplicate | дубль |
| idempotency | идемпотентность |
| rate limiter | ограничитель частоты (rate limiter) |
| edge case | граничный случай |
| follow-up question | вопрос-продолжение |
| walkthrough | разбор |

## 7. MDX rules (the build fails on these)

- In prose, `{`, `}` and `<` start JSX. Put them inside backticks (`` `O(n log n)` ``,
  `` `{'u1': 10}` ``) or write `&lt;`, `&#123;`, `&#125;`. Fenced code blocks are safe.
- Import every component you use, once, right after the frontmatter.
- Starlight components allowed: `Aside`, `Tabs`, `TabItem`, `Steps`, `Card`, `CardGrid`,
  `LinkCard`, `Badge`. Plus the practice components of §5.
- Markdown tables are fine; keep cells short, no multi-line code inside tables.
- No raw HTML except `<br />` if unavoidable. No images.

## 8. Links

- Internal links are root-relative, without locale and base, with a trailing slash:
  `[LEFT JOIN and zeros](/sql/left-join-and-zeros/)`. The build adds `/live-coding` and
  `/ru`; the Russian page uses the same link.
- External links: full `https://` URLs. Prefer the official documentation
  (postgresql.org/docs/current, docs.python.org/3): it is what the reader may open during
  the interview, so linking the exact section trains them to find it.

## 9. Code

- SQL is PostgreSQL. Keywords in capitals, one clause per line, aliases of one or two letters
  (`t` for transactions, `p` products, `m` merchants), half-open date ranges with typed literals
  (`TIMESTAMP '2026-09-01'`). "Today" is `2026-09-30`, written as a literal, never `NOW()`.
- Python is 3.12+, standard library only, money in `Decimal`, type hints where they help.
- Give each block a language tag: ` ```sql `, ` ```python `.

## 10. Numbers must come from a real run

Run every query you show and copy its output:

```bash
node scripts/sql.mjs "SELECT channel, COUNT(*) FROM transactions GROUP BY channel ORDER BY channel"
python3 -c "from decimal import Decimal; print(Decimal('0.125').quantize(Decimal('0.01')))"
```

`scripts/sql.mjs` loads the practice dataset into PGlite (the same PostgreSQL the pages
use) and prints a Markdown table. Reference results of every drill and task are in
`src/data/generated/practice.json` (`npm run exercises` rebuilds it).

## 11. Self-check before you finish

```bash
node scripts/check-mdx.mjs src/content/docs/<section>/*.mdx src/content/docs/ru/<section>/*.mdx
npm run build && npm run check:links
```

`check-mdx` checks MDX syntax, frontmatter, internal links, the translation twin and the
practice ids. The build validates the skill map; `check:links` checks every internal link
and `#anchor` in the built site. If you changed `src/data/flashcards.ts`, run
`npm run flashcards` and commit the decks. Fix every ✗.

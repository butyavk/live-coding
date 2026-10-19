# Contributing to Live Coding Map

Help is welcome: a fixed typo in a reference query is as useful as a new task. The site has the
same guide for readers at
[About → Contributing](https://butyavk.github.io/live-coding/about/contributing/).

## Report a problem

Open an [issue](https://github.com/butyavk/live-coding/issues) and say where you saw it: the
page, the exercise id (for example `s-filter` or `q01`) and what you expected. Useful reports:

- **A wrong reference.** Check passes with a wrong answer, or fails with a right one. Paste your
  query or function.
- **A confusing question.** The task text can be read in two ways, or misses a rule that the
  reference uses.
- **A wrong number or claim** in the text of a page.
- **A runtime problem.** An editor that does not load or a run that never ends. Name your browser
  and its version.
- **The Russian text** reads unnaturally or does not match the English page.

## Run the site locally

Requires Node.js 22.18+ (the content scripts import TypeScript files directly), Git, and
Python 3.10+ for `npm run exercises` and the offline exercises. The site is built with
[Astro](https://astro.build/) and its documentation theme
[Starlight](https://starlight.astro.build/).

```bash
git clone https://github.com/<your-username>/live-coding.git
cd live-coding
npm install
npm run dev        # http://localhost:4321/live-coding/
npm run build      # static site in dist/
npm run preview    # serve the built site, with search, at the same address
```

`npm run dev` and `npm run build` first copy the runtimes (PGlite, Pyodide, the dataset and
the workers, about 32 MB) into `public/runtime/`, which git ignores.

### Study from a local copy

The published site is the simplest way to study. A local copy is worth it when you study
without internet (the runtimes are served locally, so the exercises work offline too) or want
to add your own exercises. Progress lives in the browser under `localhost:4321`, separately
from the published site: move it with **Download progress** / **Load progress** on the skill
map. A `progress/` folder in the clone is ignored by git, so a downloaded progress file can
stay there without being published.

## Repository layout

| path | what |
| --- | --- |
| `src/content/docs/`, `src/content/docs/ru/` | the pages, English and Russian (same section, same file name) |
| `scripts/pages.json` | every section and slug, in sidebar order; `sidebar.order` = position + 1 |
| `src/data/skill-map.ts`, `src/data/study-plan.ts` | the map's prerequisite graph and the three plans |
| `src/data/practice/` | the exercises: SQL and Python drills, traps, task metadata |
| `src/data/generated/practice.json` | reference outputs of every exercise, written by `npm run exercises` |
| `src/data/flashcards.ts` | the flashcards (the Anki decks in `public/flashcards/` are exported from it) |
| `src/components/practice/` | the exercise widgets: drills, traps, tasks, the playground, the mock interview |
| `src/runtime/` | the PostgreSQL and Python workers and the Python test runner |
| `exercises/` | the dataset as CSV, task files, tests and solutions, also for offline practice |
| `scripts/` | build steps and checks |
| `CONTENT_GUIDE.md` | how pages are written |

A new page needs its slug in `scripts/pages.json` and a node in `src/data/skill-map.ts` with
its prerequisites, or the build fails.

## Edit the content

Read [CONTENT_GUIDE.md](CONTENT_GUIDE.md) first: page templates, frontmatter, components,
style, the English–Russian glossary and the MDX pitfalls. In short:

- **Numbers from real runs.** Every number and every output table on a page comes from a query
  you ran. Run every Python snippet you show.
- **Your own words**, plain English with British spelling, short sentences.
- **Neutral.** The dataset is an invented subscription marketplace. No real company names and
  no names of people.
- **Both languages in the same pull request.** The Russian page keeps the same structure, code
  and exercises. Task texts and phrases to say stay in English on both. Can only write one
  language? Open the pull request anyway and say so.

## Add a drill, a trap or a task

- **SQL drill**: an entry in `src/data/practice/sql-drills.ts` with an `s-` id, the question
  `q` in English and the reference query `ref`; `ordered: true` when the row order is part of
  the answer.
- **Python drill**: an entry in `src/data/practice/py-drills.ts` with a `y-` id, `q`, the
  `starter` code, the reference `ref` and `tests`. The reference must pass every test, and the
  starter must fail.
- **Trap**: an entry in `src/data/practice/traps.ts` with the `sql` that looks right and is not,
  and an optional `fix`. The question and the answer are written in the page.
- **SQL task**: the statement, the questions to ask and the output columns in
  `exercises/tasks/sql/<id>.sql`, the reference in `exercises/solutions/sql/<id>.sql`, the
  notes about the data in `src/data/practice/sql-tasks.ts`.
- **Python task**: `exercises/tasks/<file>.py` (the statement in the docstring),
  `exercises/tests/test_<file>.py`, `exercises/solutions/<file>.py`, and the brief and an
  example in `src/data/practice/py-tasks.ts`.

Then place the new id on one English and one Russian page and rebuild the reference outputs
with `npm run exercises`. Commit the regenerated `practice.json`.

## Checks

```bash
node scripts/sql.mjs "SELECT …"   # run SQL on the dataset (PGlite): every number on a page comes from a real run
node scripts/check-mdx.mjs <files>         # MDX syntax, frontmatter, links, EN/RU twin, exercise ids, for your files
node scripts/check-sql-blocks.mjs <files>  # run every SQL block of your pages; fragments fail on purpose
npm run exercises                 # run every reference again and rewrite src/data/generated/practice.json
npm run check:solutions           # the reference solutions through pytest on DuckDB (needs uv)
npm run check:content             # every page; also checks that every exercise is placed in both languages
npm run build                     # also validates the skill map graph and the study plans
npm run check:links               # internal links and anchors in dist/
npm run check:external            # every external link; slow and not in CI, since some sites block scripts
npm run flashcards                # re-export the Anki decks after editing src/data/flashcards.ts
npm run og-images                 # re-render the link-preview images (needs a Chromium for Playwright)
```

`npm run exercises` fails when a SQL reference errors or returns nothing, when a Python drill's
reference does not pass its tests or its starting code already does, and when a task file has
no metadata.

## CI and deployment

Every pull request and every push to `main` runs `.github/workflows/deploy.yml`: the reference solutions
through pytest, a check that `src/data/generated/` and the flashcard decks are current, the
content checks, the build and the link check. A push to `main` then deploys the site to GitHub
Pages. To publish your own copy, set **Settings → Pages → Source** to **GitHub Actions** and
change `site`/`base` in `astro.config.mjs`.

## Pull request checklist

- The change is in **both** the English and the Russian page, or the description says which
  half is missing.
- The frontmatter is complete: `title`, `description` (120–160 characters), `sidebar.order`.
- Every number on the page comes from a real run, and every code example was run.
- After a change in `src/data/practice/` or `exercises/`, `npm run exercises` was run and
  `practice.json` is committed.
- `npm run check:content`, `npm run build` and `npm run check:links` pass.

## Licence of contributions

By contributing, you agree that your code is published under the [MIT License](LICENSE) and
your content (text, exercises, data) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), like the rest of the project.

# staff-trainer

Training web app ("250 Grammi Team Academy") for the staff of 250 Grammi, an Italian restaurant in
Noosaville, QLD. Reference screens for the menu and service, trivia per team (Front of House, Bar,
Kitchen), progress reports, a content admin area, and a test for job candidates.

Full technical detail: `docs/ARCHITECTURE.md`. Read it before touching the data model or the
publishing flow. Prioritised backlog with the reasoning: `docs/IMPROVEMENTS.md`.

**Everything written into this repo is in English** — code, comments, docs, commit messages, test
names. The owner works in Spanish in conversation, but the repo is public-facing.

## Context and decisions already made

- **No backend, by choice.** The app is 100% client-side and stays that way for now. A backend is
  a "maybe later": do not propose it as a fix or treat it as a requirement.
- **Dual purpose**: a real training tool for the staff *and* a showcase piece for recruiters. UX
  and polish decisions carry as much weight as functionality.
- **No authentication.** The landing screen is a profile picker; the user model holds no
  passwords. This is deliberate and the screen says so.
- Consequently nothing about authentication or about data not being shared between devices counts
  as a bug: it follows from having no backend.

## Stack and layout

- **One file**: `index.html` (~213 KB, ~900 lines) with `<style>` and a single inline `<script>`.
  No framework, no modules, vanilla JS. Rendering is template strings assigned to `innerHTML`.
- `build.js`: takes `index.html`, wraps the script in an IIFE, minifies it with terser, minifies
  the HTML and writes `dist/index.html`. It used to offer an obfuscated mode as well; that was
  dropped once the repo went public, where obfuscating a file whose source sits next to it buys
  nothing and cost 2.7x the size plus 109 transitive dependencies. If `data.json` sits next to `build.js` it is embedded at the `let PUB=null;`
  anchor. **Every step fails loudly**: more than one inline `<script>`, a `data.json` that does not
  parse, a missing anchor, generated JS that does not parse, or built HTML that lost
  `<main id="app">` all exit non-zero with a message saying what to fix.
- `tests/run.js`: dependency-free safety net. Extracts the `<script>`, runs it in Node against DOM
  and `localStorage` stubs, and checks invariants that have broken before. It does not cover the
  UI: it covers what fails silently.
- `README.md`: the public face of the repo. Front door for anyone who finds it on GitHub. Two
  TODOs still open: the screenshot and the live demo link.
- `backup/`: content snapshots (questions, dishes, and the rest) in JSON and CSV. Gitignored, never
  published. See `backup/README.md`.
- `package.json`: build devDependencies only. `dist/`, `node_modules/` and `backup/` are not
  versioned. `data.json` **would be** if it exists: decide whether that is wanted.
- No backend, no database, no linter.

## Commands

```
npm install
npm run build        # dist/index.html, minified
npm test             # tests/run.js
```

Run `npm test` before and after any change to `index.html`. It is fast and needs no `npm install`.

## Mental model

All content lives in global variables at the top of the script and is persisted as a single JSON
blob in `localStorage["g250db"]`:

| Var | What it is |
|---|---|
| `D` | Dishes: `{n, c(section), p(price), i[ingredients]}`, parsed from `"name~section~price~ing;ing"` strings |
| `H` | Questions `[topic, question, correct, "wrong1|wrong2|wrong3", explanation]`. A large `H.concat()` adds the derived ones |
| `CATS` | Topics (id → name) |
| `PROF` | Teams (`foh`, `bar`, `kitchen`) with their topic list `t` |
| `PR` | Procedures (service steps, mise en place checklists) |
| `FL` | Floor plan: section → `[table, seats]` |
| `T`, `O`, `W` | Italian glossary, per-dish "what to offer" rules, wine notes |
| `USERS` | Users, role (`admin` / `user`) and team. No passwords |
| `TPL`, `TPS` | Candidate test template |

Other `localStorage` keys: `g250st` (round stats), `g250cand` (candidates), `g250timed`, `snd`,
and the seed/migration flags (`g250seed`, `g250cseed`, `g250hmig`).

Startup: `init()` → load `PUB` (embedded or `data.json`) → override with `localStorage` if there
are local edits → seed demo data on first run → `route()` (`#/test` is the candidate test,
otherwise the landing screen).

## Main flows

- **Landing**: `landing()` shows one card per entry in `USERS`; `pick()` enters. No passwords.
  Includes "Restore the demo data", which clears the `localStorage` keys and reloads.
- **Reference** (`REF`, open to every role): Menu (searchable by dish or ingredient, with
  highlighting), Italian words, Service & prep (the `PR` filtered by the trainee's team), Wines and
  Floor. Read-only, and they read the same structures the trivia is built from.
- **Trivia**: pick a team → a topic (or "Everything") → 10 questions → feedback with the why →
  result and a review of what was missed. Optional 20-second timer. Options are shuffled in
  `start()`.
- **Reports**: per user (rounds, average, best round, weakest topics, most missed questions).
  Admins see everyone.
- **Admin** (admin role only): Questions, Topics, Teams, Procedures, Dishes, Floor, Dictionary,
  Offers, Users, Candidates, Test template, Data. Generic editable tables are defined in `TC`;
  Questions and Dishes have their own editors.
- **Publishing content**: Admin → Data → *Export data.json* → copy next to `build.js` →
  `npm run build` → deploy `dist/index.html`.
- **Candidate test**: `<url>#/test`, no profile needed, questions from the template, 20 s each,
  result visible to admins only.

## Code conventions

- Short functions with 1–3 letter names (`$`, `R`, `sh`, `pk`, `fin`, `ic`...). Match the existing
  style; do not reformat the whole file, because the build and the diffs depend on it. (Whether to
  rename the global data structures is an open decision — see `docs/IMPROVEMENTS.md`.)
- UI and content are in English.
- Admin edits go through `save()`; any new model field must be added to `getDB()` and `setDB()` or
  it is neither persisted nor exported.
- All content text (questions, dishes, topic and team names, user names) is escaped with `ESC()`
  when interpolated into HTML. `ESQ` is an alias of `ESC`.
- `store.set` and `save()` return a boolean. No success message is shown without checking it: on
  failure, show `SAVE_ERR`. This covers Admin, the result of a round, and candidate submission.
- Screens with a search box render the list into `#rl` and the counter into `#rn`, refreshed from
  `root.oninput`, so focus is not lost while typing.
- When fixing a bug that failed silently, add the matching test in `tests/run.js`. A replacement or
  a lookup that finds nothing must shout, not carry on.

## Current design traits (not bugs)

Consequences of having no backend. Do not "fix" them:

- No authentication: you pick a profile and you are in. Deliberate, and stated on the landing
  screen.
- Admin edits, stats and candidates live in the `localStorage` of each browser. A candidate who
  takes the test on their phone does not reach the admin, and reports are not shared across
  devices. Publishing content means exporting `data.json` and rebuilding.
- Demo users (`alvaro`, `josefa`, `thais`, `maya`, `fede`) and fictional stats are seeded when
  there is no data. Deliberate: they bring the Reports view to life, and they are useful for the
  demo.

## Fixed in phase 2 (2026-11-23)

Each one was reproduced before being touched and has its test in `tests/run.js`.

1. **Unescaped text in the render paths.** `ESC()` only escaped `&` and `<`, and `show()`, `ans()`,
   `end()`, `cshow()`, `cdone()`, `guide()`, `home()` and `main()` interpolated raw content. A dish
   or question containing `<b>` rendered as HTML. `ESC()` now escapes `& < > " '` and is applied in
   all of those views.
2. **Silent loss in the candidate test template.** `tplQuestions()` resolves questions by exact
   text, so editing a question's wording made it vanish from the test with no warning (verified: 2
   questions → 1). The editor now keeps the original wording in `q0`, follows renames into `TPL` on
   save, drops deleted ones and reports both. The template screen warns about unresolvable entries.
3. **The question bank's "Type" column.** It said "Written" for all 535 because `qpool()` set `w:1`
   on everything. Column removed: telling written from derived needs a per-question flag.
4. **Fragile `build.js`.** Rewritten to fail loudly. Previously, if the `let PUB=null;` anchor
   changed, the build carried on and published a `dist/` with no content.
5. **Dead code.** Removed `TABS`, the whole `ED` object (13 lines, unreachable because `admin()`
   routes every tab before it), the `ed` state, the `cl` helper, `dbSaved`, the
   `<select id="sel">` handler and the `t:` and `save` branches of `adm()`.

## Done in phase 4 (2026-11-23)

1. **Reference screens.** The content was only reachable from the Admin editors and the trivia: no
   trainee-facing screen showed it, and the 5 wines were visible nowhere. Added Menu, Italian
   words, Service & prep, Wines and Floor under a "Reference" group in the nav, open to every role.
2. **`store.set` no longer swallows errors.** It returns a boolean, and so does `save()`. With
   `localStorage` full or blocked, Admin used to say "Saved 535 questions" having saved nothing, and
   the candidate test said "submitted" having lost the answers.
3. **Profile picker and landing screen.** Replaces the form with simulated credentials. Explains
   what the app is, that it is a serverless demo, and that changes stay in the browser. Includes a
   restore-demo button.
4. **README.** Screenshot and live demo link still missing.

## Outstanding technical debt

1. **412 of the 535 questions are frozen.** Only 123 are hand-written; the rest are derived from
   the menu, the mise en place and the floor plan, and live as a literal inside `index.html`. The
   app **does not regenerate them**: `gen()` only filters `H`. Edit a dish in Admin and those
   questions go stale with nobody noticing. The largest remaining content problem; worth solving
   together with the backend's data model.
2. **`H` is unreadable in diffs**: the derived questions are ~98 KB on a single line.
3. **The model does not record a question's origin.** An `origin` flag (written / derived) would
   bring the bank's column back and allow selective regeneration. The snapshot in `backup/` already
   carries that field for the current 535.
4. **`data.json` would be versioned if it exists.** Decide whether to commit it as content or
   ignore it.

## Agreed improvement flow

1. Analysis and documentation (this file + `docs/ARCHITECTURE.md`) ✅
2. Fix existing bugs ✅
3. Analyse and prioritise improvements ✅ (`docs/IMPROVEMENTS.md`)
4. Implement the chosen improvements ← in progress: 1.1, 1.2, 1.4 and 1.5 done

Next up is 1.3 (practise what I got wrong), and then 2.1 (regenerate the derived questions). The
decision about renaming the global identifiers should be taken before 2.1, so nothing is renamed
twice.

Keep this file current when the structure, the commands or the data model change.

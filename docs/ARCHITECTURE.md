# staff-trainer architecture

Reference for anyone picking up `index.html`. Sections are named rather than numbered by line,
because line numbers go stale on the first edit — search for the marker comments instead.

## 1. Shape of `index.html`

One file, in this order:

| Section | Marker / contents |
|---|---|
| Head and styles | CSS variables in `:root`, the `#shell` sidebar layout, a breakpoint at 800px, `prefers-reduced-motion` |
| App root | `<main id="app">`, the only node anything renders into |
| Data | `/* ---------- DATA ... ---------- */` → `D` dishes, `S` pizza/sin pairs, `H` questions, `T` glossary, `O` offer rules, `K`/`MISE` mise en place, `FLOW` service steps, `FL` floor plan, `W` wines |
| Engine | `/* ---------- Engine ---------- */` → `CATS` topics, helpers (`$`, `R`, `sh`, `pk`), `store`, sound, `gen(cat)` |
| Navigation | `page`, `main`, `enter`, `go`, `tgl`, `landing`, `pick`, `resetDemo`, `seedDemo`, `home` |
| Reference screens | `/* ---------- Reference ... ---------- */` → `REF`, `hl`, `refBar`, `myTeams`, `menu`, `words`, `service`, `wines`, and `guide` just above |
| Model plumbing | `SEC`, `PROF` teams, `mig`, `PR` procedures, `getDB`/`setDB`/`SEED`/`SAVE_ERR`, `init`, `route` |
| Candidate test | `cand`, `cstart`, `cshow`, `csel`, `cnext`, `cdone` |
| Quiz | `start`, then `show`, `ans`, `end` at the end of the file, plus the timer (`tmStart`/`tmStop`) |
| Admin | dish editor (`dishes`/`drows`/`dact`), question editor (`questions`/`qrows`/`qact`), generic table editor (`TC`/`table`/`trows`/`tact`), template (`tpl`/`tpact`), candidates, reports, `admin`/`adm` |

## 2. Data model

`getDB()` serialises `{v:1, D, H, T, O, FL, PR, TO:CATS, TM:PROF, U:USERS, TP:TPL, TS:TPS}`.
That object is simultaneously:

- what `save()` writes to `localStorage["g250db"]`,
- what *Export data.json* downloads,
- what `build.js` embeds as `PUB`,
- the basis for *Discard local edits* (`SEED`, the state compiled into the file, or `PUB` if present).

Precedence at startup: values in the code < `PUB` (embedded or fetched `data.json`) < `localStorage`.

```
D[]     {n, c: pizza|pasta|ante|mains|dessert|bar|spritz, p, i: string[]}
H[]     [topic, question, correct, "wrong1|wrong2|wrong3", explanation]
CATS    {id: "Display name"}            // "all" is always present
PROF    {id: {n, d, t: topic ids[]}}
PR[]    {id, n, k: "steps"|"list", tm: team ids[], it: [{g: area, t: text}]}
FL      {section: [[table, seats], ...]}
USERS   {username: {role, n, tm}}       // no passwords
TPL[]   {c: topic, q: question text}    // references H by exact text
W[]     [name, region, tasting notes, how to offer it, good for]
stats[] {u, p, c, s, t, d, m: missed question texts}   // localStorage g250st
CANDS[] {id, n, m, r, d, s, t, st, a}                  // localStorage g250cand
```

Other `localStorage` keys: `g250timed`, `snd`, and the seed/migration flags `g250seed`,
`g250cseed`, `g250hmig`.

`TPL` resolves against `H` **by exact question text** (`tplQuestions`). The question editor
handles renames: each row keeps its original wording in `q0` and `qact` rewrites matching `TPL`
entries on save, dropping entries whose question was deleted. Anything else that changes a
question's text outside that editor will silently orphan the template entry; `tpl()` warns when
it finds one.

## 3. Saving

`store.set` and `save()` return a boolean. Every success message is gated on it, and `SAVE_ERR`
is shown otherwise. This matters because `localStorage` can reject a write (full, or blocked in
private browsing) and an admin who is told "Saved" has no other way to find out. The same applies
to a finished trivia round and to a candidate submitting the test.

## 4. Building a round

`start()`:
1. For topic `all`, take 3 random questions from each of the team's topics; otherwise every
   question of that topic (`gen(cat)` filters `H`).
2. `fin()` normalises answers: leading capital, pizzas get " pizza" and their sin in brackets.
3. Shuffle the options, drop questions with duplicate options or no correct answer, cut to 10.

`ans(k)` records the result and shows the explanation; `end()` appends to `stats`.

## 5. Roles and navigation

- `landing()` lists one card per entry in `USERS`; `pick()` sets `user` and calls `enter()`.
  There is no authentication, by design, and the screen says so.
- `go(n)`: `OPEN` (trivia, reports and every `REF` screen) is available to everyone; anything else
  falls back to trivia unless `user.role == "admin"`.
- `go()` prompts before leaving an editor with unsaved changes (`te.dirty`, `tpd`, `qc`, `dc`).
- `route()` checks `#/test` before anything else, so the candidate test needs no profile.

## 6. Publishing

```
Admin → Data → Export data.json
copy data.json next to build.js
npm run build            → dist/index.html
```

`build.js` finds the single inline `<script>`, replaces `let PUB=null;` with the data, wraps it in
an IIFE, obfuscates or minifies, minifies the HTML, and verifies the result. It exits non-zero
with an explanation if any of those steps cannot be completed — see the README for the list.

## 7. Known constraints

- No backend, by choice. Reports and candidate results live in the browser that produced them.
- 412 of the 535 questions are derived from the menu, the mise en place and the floor plan, but
  they are frozen as a literal in the file: nothing regenerates them, so editing a dish leaves
  them stale. See `docs/IMPROVEMENTS.md` 2.1.
- The model has no `origin` flag per question, so written and derived questions cannot be told
  apart at runtime.
- `MR` (a meat and fish regex), `CT` and `CN` are declared and unused — leftovers of the original
  question generator and of the pre-`TPL` candidate test.

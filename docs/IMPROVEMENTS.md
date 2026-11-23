# staff-trainer — improvement backlog

Written 2026-11-23, after documenting the app and fixing the bugs that were already there.
Ordered by value over effort, not by the order things were found.

## The finding that reordered everything

Tracing which screen consumes each content structure gave this:

| Content | How much | Who reads it (before this work) |
|---|---|---|
| `D` dishes | 67, with section, price and ingredients | the Admin editor and the `pl()` helper |
| `PR` procedures | 26 service steps + 26 mise en place tasks | the Admin editor only |
| `T` glossary | 16 Italian terms | the Admin editor only |
| `O` offer rules | 9, per dish | the Admin editor only |
| `W` wines | 5, with region, tasting notes, sales pitch and occasion | **nobody** |
| `FL` floor | 5 sections, 25 tables | the Admin editor and `guide()` |
| `H` questions | 535 | the quiz |

So the app was a quiz over the content plus a floor guide, and **the content itself was invisible
to the people who need it during a shift**. A waiter who wants to know what is in the Mantovana,
which step comes next in the service, or what to say to sell the Shiraz had nowhere to look. The
wine cheatsheet — the most carefully written content in the file — was wired to no screen at all.

That is not a missing feature: it is content already written and paid for, not being shown. Best
available return, and it also makes the demo richer to click through.

## Tier 1 — high value, low effort

### 1.1 Reference screens over the existing content  ✅ DONE (2026-11-23)
Searchable menu (by dish *and* by ingredient, which is what you need when a guest asks about an
allergy), glossary, service steps, mise en place per team, wine cheatsheet. The pattern already
existed in `guide()`: a screen that reads one structure and paints cards. Turns the app from "a
quiz I take once" into "an app I open during a shift", which is a change of category, not degree.

### 1.2 `store.set` swallowed errors, so "Saved" could be a lie  ✅ DONE (2026-11-23)
```js
const store={set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
```
`save()` returned nothing and Admin showed "Saved 535 questions." anyway. With `localStorage`
full or blocked (Safari private mode, restricted storage on iOS), an admin believed the work was
saved and had lost it. Same family of bug as the ones fixed in phase 2: an operation that fails
and carries on. Fixed by returning a boolean from `store.set` and `save()` and gating every
message on it.

### 1.3 "Practise what I got wrong"  (effort: S, impact: high)  ← next
`stats[].m` already stores up to 10 missed questions per round, and Reports already shows the
most repeated ones. What is missing is the button that builds a round out of them. The biggest
teaching improvement for the least effort: without it, somebody who keeps missing the same six
questions keeps missing them.

### 1.4 Repo README  ✅ DONE (2026-11-23)
For the showcase goal, the front door is GitHub, not the app. Two TODOs left in it: a screenshot
and the live demo link.

### 1.5 Profile picker + landing screen  ✅ DONE (2026-11-23)
Replaces the form with simulated credentials. Explains what the app is, that it is a serverless
demo, and that anything changed stays in that browser. Includes a visible "Restore the demo data"
button so a visitor can poke at Admin without fear.

## Tier 2 — high value, medium effort

### 2.1 Regenerate the 412 derived questions at runtime  (effort: M/L, impact: high)
Kills three problems at once: they go stale when a dish changes, they are ~98 KB on a single line
that makes any diff unreadable, and `index.html` would shrink by nearly half. The evidence that
this once existed is in the code: `MR`, a meat and fish regex, is declared and unused, and it is
exactly what would generate the "Meat or not?" topic (which now holds 2 frozen questions). Risk:
the exact wording of those 412 will change. The snapshot in `backup/` covers that.

### 2.2 Real hash routing  (effort: M, impact: medium)
Only `#/test` is routed today; everything else is in-memory state. No deep links, the back button
does nothing, and a refresh drops you at the landing screen. Matters for sending somebody a link
to a specific screen, and reads as engineering quality.

### 2.3 PWA: manifest + service worker  (effort: M, impact: medium/high)
Installable on the staff's phones and working with no signal inside the venue, which is where it
is used. Fits the single-file constraint naturally and demos well.

### 2.4 Shift mode: procedures as checklists  (effort: M, impact: medium/high)
The `PR` items as a tickable list with progress, not as trivia. Builds on 1.1 and completes it:
the difference between studying the mise en place and using it.

## Tier 3 — high effort or a decision first

- **An `origin` flag per question and a model shaped for multi-tenancy.** Goes with the backend.
  The snapshot in `backup/` already carries that field for the current 535.
- **Accessibility**: `app.innerHTML=` wipes focus on every screen change and nothing moves it, so
  a screen-reader user loses their place. Also worth checking the contrast of `--mu`.
- **Prune `stats`** in `localStorage`: it grows without a ceiling, up to 10 question texts per
  round. Not a problem yet; it will be with real use.
- **Remaining dead code**: `MR`, `CT`, `CN`. Keep `MR` if 2.1 happens — it is part of the generator.

## The tension in the showcase goal

Worth saying plainly, because it is the least comfortable decision on this list. Somebody
technical opening `index.html` reads `let D=[...]`, `const $=s=>...`, `H`, `TC`, `pk`, `sh`,
`fin`. For a developer applying for roles, that can read as "cannot structure code" rather than
"chose a constraint deliberately". Three options:

1. **Leave it and explain it in the README.** Free. Works if the reader reaches the README before
   the code, which is not guaranteed.
2. **Rename just the ~15 global structures** (`D`→`DISHES`, `H`→`QUESTIONS`, `PROF`→`TEAMS`,
   `CATS`→`TOPICS`...), leaving the short helpers alone. Mechanical, many call sites but all of
   them covered by `getDB`/`setDB` and the tests. No functional gain.
3. **Split into modules with a build step that concatenates.** Contradicts the single-file
   constraint and is the most expensive of the three.

Recommendation: 2 plus 1. The single file is defensible and even interesting as a decision; the
one-letter names are not. Decide this before 2.1, so nothing gets renamed twice.

Related: the strongest asset this project has for that goal is not a feature, it is what surrounds
it. A reproducible build that fails loudly, a test suite that catches silent failures, documented
architecture, a content backup. That is what separates this from a weekend project, and the README
should lead with it.

## Deliberate omission worth revisiting

The menu shows no automatic "vegetarian" or "meat free" badge, even though `MR` could generate
one. A derived label that gets it wrong, in an app a waiter uses to answer a guest with a dietary
restriction, is a liability that does not pay for the convenience. Ingredient search covers the
real need without asserting anything: the waiter searches "prawn" and sees which dishes list it.
If a badge is wanted, it should be positive ("contains meat or fish"), reviewed by hand, and never
derived — an unmarked dish must not imply it is safe.

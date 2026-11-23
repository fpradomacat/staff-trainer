# 250 Grammi — Team Academy

A training app for the floor, bar and kitchen teams of [250 Grammi](https://www.250grammi.com.au),
an Italian restaurant in Noosaville, Queensland. It is the reference the staff open mid-shift —
the menu with every ingredient, the service sequence, the table plan, the wine notes — plus a
trivia round that explains the reasoning behind every answer, and a short test for job candidates.

<!-- TODO: add a screenshot, e.g. ![Team Academy](docs/screenshot.png) -->

**Live demo:** <https://fpradomacat.github.io/staff-trainer/> · pick any profile on the landing
screen, no sign-in needed.

## What it does

- **Reference.** The full menu searchable by dish *or by ingredient*, which is what you actually
  need when a guest asks what is in something. Plus the Italian glossary, the service steps, the
  mise en place checklists per team, and tasting notes for the wines by the glass.
- **Trivia.** 10-question rounds over 24 topics, scoped to the trainee's team. Every answer comes
  with the why, not just a right/wrong. Optional 20-second timer.
- **Reports.** Rounds played, average, accuracy per topic, and the questions a trainee keeps
  getting wrong.
- **Content editing.** A manager can edit the menu, the questions, the topics, the teams, the
  procedures and the floor plan from inside the app, without touching the code.
- **Candidate test.** A link (`#/test`) that gives an applicant a timed multiple-choice test and
  shows the result only to an administrator.

## Why it is one HTML file

`index.html` holds the markup, the styles, the content and the logic. That is a decision, not an
accident:

- It is served as a single static file from anywhere — a bucket, GitHub Pages, a phone's browser.
  No server, no database, no runtime dependencies.
- Restaurant wifi is unreliable. One file that loads once and keeps working beats an app that
  needs five round-trips to render.
- There is no build step to develop: open the file in a browser and you are running the app.

What it costs, and how that is handled: a single file gets long, so correctness cannot rely on
reading it. Hence `npm test` and a build that refuses to publish anything it cannot verify.

## Build and test

```bash
npm install
npm test             # tests/run.js — no dependencies needed for this one
npm run build        # dist/index.html, minified
```

Every push runs the tests and the build on CI; pushes to `master` publish `dist/` to GitHub Pages.
See `.github/workflows/ci.yml`, which is commented for anyone meeting GitHub Actions for the first
time.

The build fails loudly rather than shipping something broken: it refuses to continue if there is
more than one inline `<script>`, if `data.json` does not parse, if the injection point for that
data is missing, if the generated JavaScript does not parse, or if the minified HTML lost the app
root. A build that quietly drops the content is worse than no build.

`tests/run.js` extracts the inline script, runs it in Node against DOM and `localStorage` stubs,
and covers the failure modes that do not announce themselves: unescaped content in the render
paths, references that silently stop resolving, screens that render `undefined`, and save paths
that report success when storage rejected the write. No dependencies, runs in under a second.

## Layout

```
index.html          the app
build.js            bundler: embed content, minify, verify, write dist/
tests/run.js        regression tests, no dependencies
docs/               architecture notes and the improvement backlog
.github/workflows/  CI: test, build, publish to Pages
CLAUDE.md           working notes for AI-assisted sessions on this repo
```

## Content model

Everything the app knows lives in plain structures at the top of the script — dishes, questions,
topics, teams, procedures, the floor plan, the glossary, the wines — and is serialised as a single
JSON object. An administrator's edits are stored in that browser; exporting `data.json` and
rebuilding bakes them into the published file.

There is no backend by choice. Reports and candidate results therefore live in the browser that
produced them. A server-backed, multi-restaurant version is the obvious next step, and the data
model is already shaped for it.

## Status

Working and in use. `docs/IMPROVEMENTS.md` holds the prioritised backlog with the reasoning behind the
order; `docs/ARCHITECTURE.md` maps the file for anyone picking it up.

---

Built by Federico Prado ([@soypradito](https://github.com/fpradomacat)) while working the floor at
250 Grammi, which is where the content comes from.

// Minimal safety net, no dependencies:  node tests/run.js   (or npm test)
//
// The app is a single index.html with one inline <script>. This runner extracts that
// script, executes it in Node against DOM and localStorage stubs, and checks invariants
// that have broken before. It does not try to cover the UI: it covers what fails silently.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "index.html");
const SCRIPT_RE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

const EXPORTS = `
;globalThis.__APP={
 get H(){return H}, get D(){return D}, get T(){return T}, get W(){return W},
 get PR(){return PR}, get CATS(){return CATS}, get USERS(){return USERS},
 get TPL(){return TPL}, set TPL(v){TPL=v},
 set user(v){user=v}, set cat(v){cat=v}, set prof(v){prof=v}, set tab(v){tab=v}, set nav(v){nav=v},
 get qs(){return qs}, set qs(v){qs=v}, set i(v){i=v}, set score(v){score=v},
 get miss(){return miss}, set miss(v){miss=v}, get hits(){return hits}, set hits(v){hits=v},
 get rev(){return rev}, set rev(v){rev=v}, get stats(){return stats}, set stats(v){stats=v},
 set cd(v){cd=v}, get qd(){return qd}, get rf(){return rf},
 revPool, revUpdate, startReview, mkRound,
 ESC, fin, gen, defTpl, tplQuestions, questions, qact, dishes, dact,
 show, ans, end, cshow, cdone,
 admin, main, home, guide, reports, cand, landing, menu, menuRows, words, service, wines
};
`;

function load(opts = {}) {
  const src = fs.readFileSync(FILE, "utf8");
  const found = [...src.matchAll(SCRIPT_RE)];
  if (found.length !== 1) throw new Error("expected 1 inline script, found " + found.length);
  const code = found[0][1].replace(/\n\s*init\(\);\s*$/, "\n") + EXPORTS;

  const store = {};
  let last = "", all = "";
  const els = {};
  const make = () => {
    const e = {
      style: {}, dataset: {}, value: "", textContent: "", checked: false, className: "",
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector: () => make(), querySelectorAll: () => [], closest: () => null,
      focus() {}, click() {}, scrollIntoView() {}, appendChild() {},
      get parentNode() { return make(); }, offsetWidth: 0,
      set innerHTML(v) { last = v; all += "\n" + v; },
      get innerHTML() { return last; },
    };
    return e;
  };
  // Memoised per selector, so a test can read what the app wrote into #dmsg, #rn, etc.
  const bySel = (s) => (els[s] = els[s] || make());

  globalThis.document = {
    querySelector: bySel, querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, createElement: () => make(), body: make(),
  };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (opts.breakStorage) throw new Error("QuotaExceededError (simulated)");
      store[k] = String(v);
    },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.addEventListener = () => {};
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.location = { hash: "", reload() {} };
  globalThis.scrollTo = () => {};
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  globalThis.window = globalThis;

  new Function(code)();
  const app = globalThis.__APP;
  Object.defineProperty(app, "html", { get: () => last });
  Object.defineProperty(app, "allHtml", { get: () => all });
  app.text = (sel) => (els[sel] ? els[sel].textContent : null);
  return app;
}

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); console.log("  PASS  " + name); pass++; }
  catch (e) { console.log("  FAIL  " + name + "\n          " + e.message); fail++; }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };

const EVIL = {
  q: 'Lleva "mozzarella" <b>fresca</b>?',
  a: "Margherita <i>clasica</i>",
  w: "Opcion B|Opcion C|Opcion D",
  e: 'Nota: 1 < 2 & "listo"',
};
const raw = (html) => html.includes("<b>fresca</b>") || html.includes("<i>clasica</i>") || html.includes("<script>");

console.log("\nFile structure");
test("index.html holds exactly one inline <script>", () => {
  const found = [...fs.readFileSync(FILE, "utf8").matchAll(SCRIPT_RE)];
  eq(found.length, 1, "inline scripts found");
});
test('keeps the "let PUB=null;" anchor build.js injects into', () => {
  ok(/let\s+PUB\s*=\s*null\s*;/.test(fs.readFileSync(FILE, "utf8")), "build.js could not embed data.json");
});

console.log("\nText escaping");
test("ESC escapes & < > \" '", () => {
  const A = load();
  eq(A.ESC('<a href="x">&\'</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;", "ESC");
});
test("show() does not inject HTML from the question or the options", () => {
  const A = load();
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: EVIL.w.split("|"), e: EVIL.e, o: [EVIL.a, "B", "C", "D"] }];
  A.i = 0; A.score = 0;
  A.show();
  ok(!raw(A.html), "show() left raw HTML:\n          " + A.html.slice(0, 200));
});
test("ans() does not inject HTML from the explanation or the answer", () => {
  const A = load();
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: [], e: EVIL.e, o: [EVIL.a, "B"] }];
  A.i = 0; A.score = 0; A.miss = [];
  A.ans(1);
  ok(!raw(A.html), "ans() left raw HTML:\n          " + A.html.slice(0, 200));
});
test("end() does not inject HTML into the missed-questions review", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "user" };
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: [], e: EVIL.e, o: [EVIL.a, "B"] }];
  A.i = 0; A.score = 0;
  A.miss = [{ q: EVIL.q, a: EVIL.a, e: EVIL.e }];
  A.end();
  ok(!raw(A.html), "end() left raw HTML:\n          " + A.html.slice(0, 200));
});
test("cshow() does not inject HTML into the candidate test", () => {
  const A = load();
  A.cd = { n: "X", m: "x@y.z", r: "foh", ans: [], i: 0, q: [{ q: EVIL.q, a: EVIL.a, e: EVIL.e, o: [EVIL.a, "B"] }] };
  A.cshow();
  ok(!raw(A.html), "cshow() left raw HTML:\n          " + A.html.slice(0, 200));
});
test("the reference screens do not inject HTML from the content", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "admin" };
  A.D.length = 0;
  A.D.push({ n: "Pizza <b>fresca</b>", c: "pizza", p: 10, i: ["<i>clasica</i>", "basil"] });
  A.T.length = 0; A.T.push(["<b>fresca</b>", "<i>clasica</i>"]);
  A.W.length = 0; A.W.push(["<b>fresca</b>", "<i>clasica</i>", "notas", "pitch", "ocasion"]);
  A.menu(); ok(!raw(A.allHtml), "menu() left raw HTML");
  A.words(); ok(!raw(A.allHtml), "words() left raw HTML");
  A.wines(); ok(!raw(A.allHtml), "wines() left raw HTML");
});

console.log("\nReference screens");
test("the menu lists every dish, grouped by section", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "user", tm: "foh" };
  A.menu();
  eq(A.text("#rn"), A.D.length + " dishes", "the counter does not match");
  ok(A.allHtml.includes("Margherita"), "a known dish is missing");
});
test("the menu filters by ingredient", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "user", tm: "foh" };
  A.menu();
  A.rf.menu = "prawn";
  A.menuRows();
  const esperados = A.D.filter((d) => (d.n + " " + d.i.join(" ")).toLowerCase().includes("prawn")).length;
  ok(esperados > 0, "no dish in the fixture contains prawn");
  eq(A.text("#rn"), `${esperados} of ${A.D.length} dishes match "prawn"`, "the filter result does not match");
});
test("a bar trainee does not see another team's procedures", () => {
  const A = load();
  A.user = { u: "josefa", n: "Josefa", role: "user", tm: "bar" };
  A.service();
  const otros = A.PR.filter((p) => p.tm.length && !p.tm.includes("bar"));
  ok(otros.length > 0, "there are no other teams' procedures to check against");
  otros.forEach((p) => ok(!A.allHtml.includes(p.n), "another team's procedure is showing: " + p.n));
});
test("the wines screen shows the notes that were unreachable before", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "user", tm: "foh" };
  A.wines();
  ok(A.W.length > 0, "no wines loaded");
  A.W.forEach((w) => ok(A.allHtml.includes(A.ESC(w[0])), "missing wine: " + w[0]));
});

console.log("\nProfile picker");
test("the landing screen offers one profile per user and no password field", () => {
  const A = load();
  A.landing();
  const h = A.html;
  Object.values(A.USERS).forEach((a) => ok(h.includes(A.ESC(a.n)), "missing user: " + a.n));
  ok(!/type="password"/.test(h), "there is still a password field");
  ok(!/id="dologin"/.test(h), "there is still a sign-in button");
});
test("the user model no longer stores passwords", () => {
  const A = load();
  const conPass = Object.entries(A.USERS).filter(([, a]) => a.p !== undefined);
  eq(conPass.length, 0, "users carrying a password: " + conPass.map(([k]) => k).join(", "));
});

console.log("\nSaving cannot lie");
test("when localStorage fails, Admin does not claim it saved", () => {
  const A = load({ breakStorage: true });
  A.user = { u: "admin", n: "Admin", role: "admin" };
  A.dishes();
  A.dact({ dataset: { d: "save" }, closest: () => null });
  const m = A.text("#dmsg") || "";
  ok(/could not save/i.test(m), 'the message should report the failure, it says: "' + m + '"');
  ok(!/^Saved /.test(m), "it claims it saved when it did not");
});
test("when localStorage fails, the candidate test does not claim submission", () => {
  const A = load({ breakStorage: true });
  A.cd = { n: "Ana Perez", m: "a@b.co", r: "foh", ans: [0], i: 1, q: [{ q: "P", a: "A", e: "", o: ["A", "B"] }] };
  A.cdone();
  ok(!/have been submitted/.test(A.html), "it tells the candidate it was submitted when nothing was stored");
  ok(/could not be stored/i.test(A.html), "it does not report the failure");
});
test("when localStorage works, Admin confirms the save", () => {
  const A = load();
  A.user = { u: "admin", n: "Admin", role: "admin" };
  A.dishes();
  A.dact({ dataset: { d: "save" }, closest: () => null });
  ok(/^Saved \d+ dishes\./.test(A.text("#dmsg") || ""), "no confirmation: " + A.text("#dmsg"));
});

console.log("\nReview queue");
const trainee = (A, tm) => { A.user = { u: "test", n: "Test", role: "user", tm: tm || "foh" }; A.prof = tm || "foh"; };
const aQuestion = (A, topic) => { const h = A.H.find((x) => x[0] === (topic || "pizza")); return { q: h[1], a: h[2], w: [], e: h[4] }; };

test("a missed question joins the queue and a correct answer clears it", () => {
  const A = load();
  trainee(A);
  const q = aQuestion(A);
  A.miss = [q]; A.hits = [];
  A.revUpdate();
  ok(A.revPool().some((x) => x.q === q.q), "the miss did not reach the queue");
  A.miss = []; A.hits = [q];
  A.revUpdate();
  ok(!A.revPool().some((x) => x.q === q.q), "the correct answer did not clear it");
});
test("two misses take two correct answers to clear", () => {
  const A = load();
  trainee(A);
  const q = aQuestion(A);
  A.miss = [q]; A.hits = [];
  A.revUpdate(); A.revUpdate();
  A.miss = []; A.hits = [q];
  A.revUpdate();
  ok(A.revPool().some((x) => x.q === q.q), "one correct answer should not be enough after two misses");
  const r = A.revUpdate();
  ok(!A.revPool().some((x) => x.q === q.q), "the second correct answer did not clear it");
  eq(r.cleared, 1, "the cleared count is wrong");
});
test("a review round only asks questions that are in the queue", () => {
  const A = load();
  trainee(A);
  const picks = A.H.filter((x) => x[0] === "pizza").slice(0, 4);
  A.miss = picks.map((h) => ({ q: h[1] })); A.hits = [];
  A.revUpdate();
  A.startReview();
  ok(A.qs.length > 0, "the review round came out empty");
  const inQueue = new Set(picks.map((h) => h[1]));
  A.qs.forEach((x) => ok(inQueue.has(x.q), "the round asked something outside the queue: " + x.q));
  ok(A.rev === true, "the round was not flagged as a review round");
});
test("the queue belongs to one user, not to the browser", () => {
  const A = load();
  trainee(A);
  const q = aQuestion(A);
  A.miss = [q]; A.hits = [];
  A.revUpdate();
  A.user = { u: "someone-else", n: "Other", role: "user", tm: "foh" };
  eq(A.revPool().length, 0, "another user inherited the queue");
});
test("a bar trainee does not get another team's questions to review", () => {
  const A = load();
  trainee(A, "bar");
  const q = aQuestion(A, "pizza");
  A.miss = [q]; A.hits = [];
  A.revUpdate();
  eq(A.revPool().length, 0, "a pizza question showed up in a bar trainee's queue");
});
test("the topics screen offers the review button only when there is something to review", () => {
  const A = load();
  trainee(A);
  A.home();
  ok(/Nothing to review yet/.test(A.html), "it does not say the queue is empty");
  ok(/id="rev" disabled/.test(A.html), "the button is not disabled on an empty queue");
  A.miss = [aQuestion(A)]; A.hits = [];
  A.revUpdate();
  A.home();
  ok(/Review my mistakes \(1\)/.test(A.html), "it does not show the count: " + (A.html.match(/id="rev"[^>]*>[^<]*/) || [""])[0]);
});
test("a review round is recorded in its own bucket, not against a topic", () => {
  const A = load();
  trainee(A);
  A.stats = [];
  A.rev = true;
  A.qs = [{ q: "Q", a: "A", w: ["B"], e: "", o: ["A", "B"] }];
  A.i = 0; A.score = 1; A.miss = []; A.hits = [];
  A.end();
  eq(A.stats.length, 1, "the round was not recorded");
  eq(A.stats[0].c, "review", "the bucket is wrong");
});

console.log("\nCandidate test template");
test("the default template resolves every one of its questions", () => {
  const A = load();
  eq(A.tplQuestions().length, A.defTpl().length, "defTpl() proposes questions that are not in the bank");
});
test("renaming a question keeps it in the template", () => {
  const A = load();
  A.questions();
  const row = A.qd.find((x) => x.c === "story");
  const before = row.q0;
  A.TPL = [{ c: "story", q: before }];
  row.q = before + " (reformulada)";
  A.qact({ dataset: { qa: "save" }, closest: () => null });
  eq(A.TPL.length, 1, "the template lost the question");
  eq(A.TPL[0].q, before + " (reformulada)", "the template did not follow the rename");
  ok(A.H.some((h) => h[1] === before + " (reformulada)"), "H did not store the new wording");
});
test("deleting a question removes it from the template", () => {
  const A = load();
  A.questions();
  const row = A.qd.find((x) => x.c === "story");
  A.TPL = [{ c: "story", q: row.q0 }];
  A.qd.splice(A.qd.indexOf(row), 1);
  A.qact({ dataset: { qa: "save" }, closest: () => null });
  eq(A.TPL.length, 0, "the template still points at a question that no longer exists");
});

console.log("\nEvery screen renders");
[["q","Questions"],["tp","Topics"],["tm","Teams"],["pr","Procedures"],["d","Dishes"],
 ["f","Floor"],["dict","Dictionary"],["off","Offers"],["u","Users"],["cand","Candidates"],
 ["tpl","Test template"],["x","Data"]].forEach(([t, label]) => {
  test("Admin > " + label, () => {
    const A = load();
    A.user = { u: "admin", n: "Admin", role: "admin" };
    A.tab = t; A.nav = t;
    A.admin();
    const h = A.html || "";
    ok(h.length > 0, "empty render");
    ok(!/\bundefined\b/.test(h), "the HTML contains 'undefined'");
    ok(!/\[object Object\]/.test(h), "the HTML contains [object Object]");
  });
});
[["landing","Landing"],["main","Pick a team"],["home","Topics"],["menu","Menu"],["words","Italian words"],
 ["service","Service & prep"],["wines","Wines"],["guide","Floor"],["reports","Reports"],["cand","Candidate test"]]
  .forEach(([fn, label]) => {
    test("Screen: " + label, () => {
      const A = load();
      A.user = { u: "test", n: "Test user", role: "user", tm: "foh" };
      A.prof = "foh";
      A[fn]();
      const h = A.allHtml || "";
      ok(h.length > 0, "empty render");
      ok(!/\bundefined\b/.test(h), "the HTML contains 'undefined'");
      ok(!/\[object Object\]/.test(h), "the HTML contains [object Object]");
    });
  });

console.log("\nContent sanity");
test("no question is silently dropped when a round is built", () => {
  const A = load();
  const bad = A.H.map((h) => ({ q: h[1], a: h[2], w: h[3].split("|").filter(Boolean), e: h[4] }))
    .map(A.fin)
    .filter((q) => {
      const o = [q.a, ...q.w];
      return o.length < 2 || new Set(o).size !== o.length || !o.includes(q.a);
    });
  eq(bad.length, 0, "questions the quiz would drop: " + bad.slice(0, 3).map((q) => q.q).join(" / "));
});
test("every topic that has questions is declared in CATS", () => {
  const A = load();
  const huerfanos = [...new Set(A.H.map((h) => h[0]))].filter((t) => !A.CATS[t]);
  eq(huerfanos.length, 0, "topics with no name: " + huerfanos.join(", "));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

// Red de seguridad minima, sin dependencias:  node tests/run.js   (o npm test)
//
// La app es un solo index.html con un <script> inline. Este runner extrae ese script,
// lo ejecuta en Node con stubs de DOM/localStorage y comprueba invariantes que ya se
// rompieron una vez. No pretende cubrir la UI: cubre lo que falla en silencio.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "index.html");
const SCRIPT_RE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;

const EXPORTS = `
;globalThis.__APP={
 get H(){return H}, get D(){return D}, get CATS(){return CATS},
 get TPL(){return TPL}, set TPL(v){TPL=v},
 set user(v){user=v}, set cat(v){cat=v}, set prof(v){prof=v},
 get qs(){return qs}, set qs(v){qs=v}, set i(v){i=v}, set score(v){score=v},
 set miss(v){miss=v}, set cd(v){cd=v},
 get qd(){return qd},
 set tab(v){tab=v}, set nav(v){nav=v},
 ESC, fin, gen, defTpl, tplQuestions, questions, qact, show, ans, end, cshow,
 admin, main, home, guide, reports, cand,
 get html(){return globalThis.__HTML}
};
`;

function load() {
  const src = fs.readFileSync(FILE, "utf8");
  const found = [...src.matchAll(SCRIPT_RE)];
  if (found.length !== 1) throw new Error("se esperaba 1 script inline, hay " + found.length);
  const code = found[0][1].replace(/\n\s*init\(\);\s*$/, "\n") + EXPORTS;

  const store = {};
  globalThis.__HTML = "";
  const el = () => ({
    style: {}, dataset: {}, value: "", textContent: "", checked: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => el(), querySelectorAll: () => [], closest: () => null,
    focus() {}, click() {}, scrollIntoView() {}, appendChild() {},
    get parentNode() { return el(); }, offsetWidth: 0,
    set innerHTML(v) { globalThis.__HTML = v; },
    get innerHTML() { return globalThis.__HTML; },
  });
  globalThis.document = {
    querySelector: () => el(), querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, createElement: () => el(), body: el(),
  };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.addEventListener = () => {};
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.location = { hash: "" };
  globalThis.scrollTo = () => {};
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  globalThis.window = globalThis;

  new Function(code)();
  return globalThis.__APP;
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

console.log("\nEstructura del archivo");
test("index.html tiene exactamente un <script> inline", () => {
  const found = [...fs.readFileSync(FILE, "utf8").matchAll(SCRIPT_RE)];
  eq(found.length, 1, "scripts inline encontrados");
});
test('conserva el anclaje "let PUB=null;" que usa build.js', () => {
  ok(/let\s+PUB\s*=\s*null\s*;/.test(fs.readFileSync(FILE, "utf8")), "build.js no podria embeber data.json");
});

console.log("\nEscapado de texto");
test("ESC escapa & < > \" '", () => {
  const A = load();
  eq(A.ESC('<a href="x">&\'</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;", "ESC");
});
test("show() no inyecta HTML de la pregunta ni de las opciones", () => {
  const A = load();
  A.H.length = 0;
  A.H.push(["pizza", EVIL.q, EVIL.a, EVIL.w, EVIL.e]);
  A.cat = "pizza"; A.prof = "foh";
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: EVIL.w.split("|"), e: EVIL.e, o: [EVIL.a, "B", "C", "D"] }];
  A.i = 0; A.score = 0;
  A.show();
  ok(!raw(A.html), "show() dejo HTML crudo:\n          " + A.html.slice(0, 200));
});
test("ans() no inyecta HTML de la explicacion ni de la respuesta", () => {
  const A = load();
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: [], e: EVIL.e, o: [EVIL.a, "B"] }];
  A.i = 0; A.score = 0; A.miss = [];
  A.ans(1);
  ok(!raw(A.html), "ans() dejo HTML crudo:\n          " + A.html.slice(0, 200));
});
test("end() no inyecta HTML en el repaso de falladas", () => {
  const A = load();
  A.user = { u: "test", n: "Test", role: "user" };
  A.qs = [{ q: EVIL.q, a: EVIL.a, w: [], e: EVIL.e, o: [EVIL.a, "B"] }];
  A.i = 0; A.score = 0;
  A.miss = [{ q: EVIL.q, a: EVIL.a, e: EVIL.e }];
  A.end();
  ok(!raw(A.html), "end() dejo HTML crudo:\n          " + A.html.slice(0, 200));
});
test("cshow() no inyecta HTML en el test de candidatos", () => {
  const A = load();
  A.cd = { n: "X", m: "x@y.z", r: "foh", ans: [], i: 0, q: [{ q: EVIL.q, a: EVIL.a, e: EVIL.e, o: [EVIL.a, "B"] }] };
  A.cshow();
  ok(!raw(A.html), "cshow() dejo HTML crudo:\n          " + A.html.slice(0, 200));
});

console.log("\nPlantilla del test de candidatos");
test("la plantilla por defecto resuelve todas sus preguntas", () => {
  const A = load();
  const def = A.defTpl().length, res = A.tplQuestions().length;
  eq(res, def, "defTpl() propone preguntas que no existen en el banco");
});
test("renombrar una pregunta la mantiene en la plantilla", () => {
  const A = load();
  A.questions();
  const row = A.qd.find((x) => x.c === "story");
  const before = row.q0;
  A.TPL = [{ c: "story", q: before }];
  row.q = before + " (reformulada)";
  A.qact({ dataset: { qa: "save" }, closest: () => null });
  eq(A.TPL.length, 1, "la plantilla perdio la pregunta");
  eq(A.TPL[0].q, before + " (reformulada)", "la plantilla no siguio el renombre");
  ok(A.H.some((h) => h[1] === before + " (reformulada)"), "H no guardo el nuevo enunciado");
});
test("borrar una pregunta la saca de la plantilla", () => {
  const A = load();
  A.questions();
  const row = A.qd.find((x) => x.c === "story");
  A.TPL = [{ c: "story", q: row.q0 }];
  A.qd.splice(A.qd.indexOf(row), 1);
  A.qact({ dataset: { qa: "save" }, closest: () => null });
  eq(A.TPL.length, 0, "la plantilla quedo apuntando a una pregunta inexistente");
});

console.log("\nTodas las pantallas renderizan");
const ADMIN_TABS = [["q","Questions"],["tp","Topics"],["tm","Teams"],["pr","Procedures"],["d","Dishes"],
  ["f","Floor"],["dict","Dictionary"],["off","Offers"],["u","Users"],["cand","Candidates"],
  ["tpl","Test template"],["x","Data"]];
ADMIN_TABS.forEach(([t, label]) => {
  test("Admin > " + label, () => {
    const A = load();
    A.user = { u: "admin", n: "Admin", role: "admin", p: "admin" };
    A.tab = t; A.nav = t;
    A.admin();
    const h = A.html || "";
    ok(h.length > 0, "render vacio");
    ok(!/\bundefined\b/.test(h), "el HTML contiene 'undefined'");
    ok(!/\[object Object\]/.test(h), "el HTML contiene [object Object]");
  });
});
[["main","Elegir equipo"],["home","Temas"],["guide","Guia de salon"],["reports","Reportes"],["cand","Test de candidato"]]
  .forEach(([fn, label]) => {
    test("Pantalla: " + label, () => {
      const A = load();
      A.user = { u: "test", n: "Test user", role: "user", p: "test" };
      A.prof = "foh";
      A[fn]();
      const h = A.html || "";
      ok(h.length > 0, "render vacio");
      ok(!/\bundefined\b/.test(h), "el HTML contiene 'undefined'");
    });
  });

console.log("\nSanidad del contenido");
test("ninguna pregunta se descarta sola al armar una ronda", () => {
  const A = load();
  // start() filtra en silencio las preguntas con opciones repetidas o sin la correcta.
  const bad = A.H.map((h) => ({ q: h[1], a: h[2], w: h[3].split("|").filter(Boolean), e: h[4] }))
    .map(A.fin)
    .filter((q) => {
      const o = [q.a, ...q.w];
      return o.length < 2 || new Set(o).size !== o.length || !o.includes(q.a);
    });
  eq(bad.length, 0, "preguntas que el quiz descartaria: " + bad.slice(0, 3).map((q) => q.q).join(" / "));
});
test("todos los temas con preguntas estan declarados en CATS", () => {
  const A = load();
  const huerfanos = [...new Set(A.H.map((h) => h[0]))].filter((t) => !A.CATS[t]);
  eq(huerfanos.length, 0, "temas sin nombre: " + huerfanos.join(", "));
});

console.log(`\n${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail ? 1 : 0);

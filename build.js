// Usage:
//   npm install
//   npm run build   -> dist/index.html (minified)
//   npm test        -> tests/run.js
//
// If data.json sits next to this file (exported from Admin > Data), its contents are
// embedded into the bundle so the published app ships with that content already loaded.
// Every step below fails loudly: a silent build that quietly drops the data or ships
// broken JavaScript is worse than no build at all.
const fs = require("fs");
const path = require("path");
const { minify: terser } = require("terser");
const { minify: htmlMin } = require("html-minifier-terser");

const ROOT = __dirname;
const SRC = path.join(ROOT, "index.html");
const DATA = path.join(ROOT, "data.json");
const OUT_DIR = path.join(ROOT, "dist");
const OUT = path.join(OUT_DIR, "index.html");

// Inline <script> = one without a src attribute. Tolerates attributes and casing.
const SCRIPT_RE = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
// Where data.json gets injected. Tolerates whitespace changes around the statement.
const PUB_RE = /let\s+PUB\s*=\s*null\s*;/;

const die = (msg) => {
  console.error("\nBuild failed: " + msg + "\n");
  process.exit(1);
};
const kb = (n) => (n / 1024).toFixed(1) + " KB";

(async () => {
  if (!fs.existsSync(SRC)) die(SRC + " not found.");
  const src = fs.readFileSync(SRC, "utf8");

  const found = [...src.matchAll(SCRIPT_RE)];
  if (found.length === 0) die("no inline <script> found in index.html.");
  if (found.length > 1)
    die(
      `expected exactly one inline <script> in index.html, found ${found.length}. ` +
        "The build would silently bundle only the first one. Merge them, give the others a " +
        "src attribute, or teach build.js which one holds the app."
    );
  const scriptTag = found[0][0];
  let code = found[0][1];

  if (fs.existsSync(DATA)) {
    const raw = fs.readFileSync(DATA, "utf8").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      die("data.json is not valid JSON: " + e.message);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      die("data.json must hold a JSON object (the shape Admin > Data exports).");
    if (!PUB_RE.test(code))
      die(
        'data.json exists but the injection point "let PUB=null;" is gone from index.html, ' +
          "so the content could not be embedded. Put that statement back, or update PUB_RE in build.js."
      );
    code = code.replace(PUB_RE, () => "let PUB=" + raw + ";");
    if (PUB_RE.test(code)) die("the data.json injection did not take effect.");
    console.log(
      `data.json      ${kb(Buffer.byteLength(raw))} embedded (keys: ${Object.keys(parsed).join(", ")})`
    );
  } else {
    console.log(
      "data.json      not present -> building without embedded content " +
        "(the app still tries to fetch data.json at runtime)"
    );
  }

  // Wrap in an IIFE so every identifier can be renamed safely.
  const r = await terser("(function(){" + code + "\n})();", { compress: true, mangle: true });
  if (!r.code) die("terser returned no code.");
  const js = r.code;
  if (js.length < 1000) die("the generated JavaScript is suspiciously small (" + js.length + " chars).");

  // Parse-check the result before shipping it. new Function compiles without running.
  try {
    new Function(js);
  } catch (e) {
    die("the generated JavaScript does not parse: " + e.message);
  }

  // Replace via a function so "$" in the code is never treated as a pattern.
  let html = src.replace(scriptTag, () => "<script>" + js + "</script>");
  if (html === src) die("could not splice the built script back into the HTML.");

  html = await htmlMin(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: false,
  });

  // The minifier is the last thing that touches the file, so check its output too.
  if (!/<main id="app">/.test(html)) die('the built HTML lost <main id="app">.');
  if ([...html.matchAll(SCRIPT_RE)].length !== 1) die("the built HTML does not hold exactly one inline script.");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`index.html     ${kb(Buffer.byteLength(src))} -> dist/index.html ${kb(Buffer.byteLength(html))}`);
})().catch((e) => die(e && e.stack ? e.stack : String(e)));

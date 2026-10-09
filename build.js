// Usage:
//   npm install
//   npm run build        -> dist/index.html (obfuscated + minified, harder to read)
//   npm run build:min    -> dist/index.html (minified only, smaller, easier to read)
const fs = require("fs");
const JO = require("javascript-obfuscator");
const { minify: terser } = require("terser");
const { minify: htmlMin } = require("html-minifier-terser");

const light = process.argv.includes("--light");

(async () => {
  const src = fs.readFileSync("index.html", "utf8");
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("No inline <script> found in index.html");

  // Wrap in an IIFE so every identifier can be renamed safely.
  let code = m[1];
  // If data.json exists (exported from the Admin screen), embed it so it ships obfuscated inside index.html.
  if (fs.existsSync("data.json")) {
    const data = fs.readFileSync("data.json", "utf8").trim();
    JSON.parse(data);
    code = code.replace("let PUB=null;", () => "let PUB=" + data + ";");
  }
  let js = "(function(){" + code + "\n})();";

  if (light) {
    js = (await terser(js, { compress: true, mangle: true })).code;
  } else {
    js = JO.obfuscate(js, {
      compact: true,
      identifierNamesGenerator: "hexadecimal",
      stringArray: true,
      stringArrayThreshold: 1,
      stringArrayEncoding: ["base64"],
      rotateStringArray: true,
      shuffleStringArray: true,
      splitStrings: true,
      splitStringsChunkLength: 8,
      disableConsoleOutput: true,
      // Heavier options make the file much bigger and slower on phones.
      controlFlowFlattening: false,
      deadCodeInjection: false,
      selfDefending: false,
    }).getObfuscatedCode();
  }

  // Replace via a function so "$" in the code is never treated as a pattern.
  let html = src.replace(m[0], () => "<script>" + js + "</script>");
  html = await htmlMin(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: false,
  });

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/index.html", html);
  const kb = (n) => (n / 1024).toFixed(1) + " KB";
  console.log(`index.html ${kb(Buffer.byteLength(src))} -> dist/index.html ${kb(Buffer.byteLength(html))}`);
})();

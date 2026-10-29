// Verifies every static t("key") used in src exists in all five locales (plural keys via _one/_other).
import fs from "fs"; import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const files = []; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|ts)$/.test(f)) files.push(p); } };
walk(path.join(root, "src"));
const keys = new Set();
for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) keys.add(m[1]);
let bad = 0;
for (const lang of ["en", "da", "de", "sv", "nb"]) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "src/locales", `${lang}.json`), "utf8"));
  const get = (k) => k.split(".").reduce((o, p) => (o == null ? o : o[p]), j);
  for (const k of keys) if (get(k) === undefined && get(k + "_other") === undefined) { console.log(`${lang}: missing ${k}`); bad++; }
}
console.log(keys.size, "static keys checked,", bad, "missing"); process.exit(bad ? 1 : 0);

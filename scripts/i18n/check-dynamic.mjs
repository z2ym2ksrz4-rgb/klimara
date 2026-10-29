// Dynamic t(`…${x}`) keys the static checker cannot see: groups, portions, Bristol types, phases, tags, foods.
import fs from "fs"; import path from "path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const tags = fs.readFileSync(path.join(root, "src/domain/fodmara/tagsets.ts"), "utf8");
const groups = [...tags.matchAll(/key: "(\w+)",\s*kind: "\w+",\s*tags: \[([^\]]+)\]/g)].map((m) => [m[1], [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1])]);
const foods = [...fs.readFileSync(path.join(root, "src/domain/fodmara/foods.ts"), "utf8").matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
const G = ["fructan", "gos", "lactose", "fructose", "sorbitol", "mannitol"];
const need = [
  ...G.flatMap((g) => [`fodmap.group.${g}`, `fodmap.groupHint.${g}`]),
  ...[0, 1, 2].flatMap((i) => [`test.portion.${i}`, `test.portionShort.${i}`]),
  ...["tolerated", "some", "reaction"].flatMap((r) => [`test.result.${r}`, `test.resultShort.${r}`]),
  ...[1, 2, 3, 4, 5, 6, 7].flatMap((n) => [`stool.type.${n}`, `stool.typeLong.${n}`]),
  ...["notStarted", "elimination", "reintro", "personal"].map((p) => `phase.${p}`), ...["elimination", "reintro", "personal"].map((p) => `phase.${p}Short`),
  ...["diarrhoea", "constipation", "mixed", "unsure"].map((x) => `onboarding.type.${x}`), ...["yes", "inProgress", "no"].map((x) => `onboarding.diagnosed.${x}`),
  ...["lt1y", "1to5y", "gt5y"].map((x) => `onboarding.since.${x}`),
  ...["veg", "fruit", "grain", "dairy", "protein", "legume", "nut", "drink", "other"].map((c) => `food.cat.${c}`),
  ...["none", "mild", "moderate", "bad", "veryBad"].map((x) => `gutScale.level.${x}`),
  ...["bloating", "pain", "sleep", "stress"].flatMap((k) => [`home.fields.${k}`, `home.fieldHint.${k}`]),
  ...["sleep", "stress"].flatMap((k) => [`insights.contrast.${k}`, `learn.contrast.${k}`]),
  ...groups.flatMap(([g, ts]) => [`diary.groups.${g}`, `episode.journey.${g}`, ...ts.map((t) => `diary.tags.${g}.${t}`)]),
  ...foods.map((f) => `food.items.${f}`), "paywall.reasons.reintro",
];
let bad = 0;
for (const lang of ["en", "da", "de", "sv", "nb"]) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "src/locales", `${lang}.json`), "utf8"));
  for (const k of need) if (k.split(".").reduce((o, p) => (o == null ? o : o[p]), j) == null) { console.log(`${lang}: missing ${k}`); bad++; }
}
console.log(need.length, "dynamic keys checked,", bad, "missing"); process.exit(bad ? 1 : 0);

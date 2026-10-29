// Compose App Store / Play marketing screenshots from the raw captures in store/screenshots/<lang>/.
// Usage: node scripts/store-frames.mjs [lang...]   (run scripts/screenshots.mjs first)
// Output: store/screenshots/<lang>/store-<device>-<n>.png — exact store pixel sizes, no paywall shot.
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "da", "de", "sv", "nb"];
const DEVICES = { "iphone-6.7": { w: 1290, h: 2796, radius: 150 }, "iphone-6.1": { w: 1179, h: 2556, radius: 140 }, "android": { w: 1080, h: 2400, radius: 110 } };
const SHOTS = ["home", "meal", "test", "insights", "patterns", "report"]; // calendar/settings/paywall intentionally excluded
const COPY = {
  en: ["One number a day for your gut", "Meals in five seconds", "Test one FODMAP group at a time", "See your gut over time", "What comes before a flare-up", "A PDF for your dietitian"],
  da: ["Ét tal om dagen for maven", "Måltider på fem sekunder", "Test én FODMAP-gruppe ad gangen", "Se maven over tid", "Hvad der kommer før et udbrud", "En PDF til din diætist"],
  de: ["Eine Zahl pro Tag für Ihren Bauch", "Mahlzeiten in fünf Sekunden", "Eine FODMAP-Gruppe nach der anderen", "Ihr Bauch im Verlauf", "Was vor Beschwerden kommt", "Ein PDF für die Ernährungsberatung"],
  sv: ["En siffra om dagen för magen", "Måltider på fem sekunder", "Testa en FODMAP-grupp i taget", "Se magen över tid", "Vad som kommer före ett skov", "En PDF till din dietist"],
  nb: ["Ett tall om dagen for magen", "Måltider på fem sekunder", "Test én FODMAP-gruppe om gangen", "Se magen over tid", "Hva som kommer før en oppblussing", "En PDF til ernæringsfysiologen"],
};
const SUB = { en: "No account. Your diary stays on your phone.", da: "Ingen konto. Din dagbog bliver på din telefon.", de: "Kein Konto. Ihr Tagebuch bleibt auf dem Handy.", sv: "Inget konto. Din dagbok stannar i telefonen.", nb: "Ingen konto. Dagboken din blir på telefonen." };
const MARK = readFileSync(resolve("resources/icon-foreground.svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const html = ({ w, h, radius, title, sub, img, last }) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:-apple-system,Inter,"Segoe UI",Roboto,sans-serif;background:linear-gradient(160deg,#2F5A4E 0%,#1A3330 100%);color:#F6F1E8;position:relative}
  .copy{position:absolute;top:${Math.round(h*0.055)}px;left:0;right:0;text-align:center;padding:0 ${Math.round(w*0.08)}px}
  h1{margin:0;font-size:${Math.round(w*0.082)}px;line-height:1.1;font-weight:800;letter-spacing:-0.02em}
  p{margin:${Math.round(w*0.02)}px 0 0;font-size:${Math.round(w*0.036)}px;opacity:.85;font-weight:500}
  .device{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round(h*0.235)}px;width:${Math.round(w*0.80)}px;height:${Math.round(w*0.80*(h/w))}px;border-radius:${radius}px;background:#111;padding:${Math.round(w*0.018)}px;box-sizing:border-box;box-shadow:0 ${Math.round(w*0.05)}px ${Math.round(w*0.12)}px rgba(0,0,0,.35)}
  .device img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:${radius-Math.round(w*0.018)}px;display:block}
  .mark{position:absolute;right:${Math.round(w*0.05)}px;bottom:${Math.round(h*0.02)}px;width:${Math.round(w*0.13)}px;opacity:.55}
</style></head><body>
  <div class="copy"><h1>${title}</h1><p>${last ? sub : ""}</p></div>
  <div class="device"><img src="${img}"></div>
  <svg class="mark" viewBox="0 0 1024 1024">${MARK}</svg>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const lang of LANGS) {
  for (const [device, d] of Object.entries(DEVICES)) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1 });
    let n = 0;
    for (const [i, shot] of SHOTS.entries()) {
      const src = resolve(`store/screenshots/${lang}/${device}-${i + 1}-${shot}.png`);
      if (!existsSync(src)) { console.warn("missing", src); continue; }
      const img = `data:image/png;base64,${readFileSync(src).toString("base64")}`;
      await page.setContent(html({ ...d, title: COPY[lang][i], sub: SUB[lang], img, last: i === 0 }));
      await page.screenshot({ path: `store/screenshots/${lang}/store-${device}-${++n}.png`, clip: { x: 0, y: 0, width: d.w, height: d.h } });
    }
    await page.close(); console.log(`${lang}/${device}: ${n} store images`);
  }
}
await browser.close();

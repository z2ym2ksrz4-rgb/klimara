// Store screenshots with demo data. Usage: RELEASE=0 NODE_ENV=development npx vite build --mode development && (npx vite preview --port 4173 &) && node scripts/screenshots.mjs [lang...]
// Output: store/screenshots/<lang>/<device>-<n>-<name>.png  (raw captures; scripts/store-frames.mjs composes the marketing images)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "da", "de", "sv", "nb"];
const DEVICES = {
  "iphone-6.7": { width: 430, height: 932, deviceScaleFactor: 3 },   // 1290×2796
  "iphone-6.1": { width: 393, height: 852, deviceScaleFactor: 3 },   // 1179×2556
  "android":    { width: 360, height: 800, deviceScaleFactor: 3 },   // 1080×2400
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const lang of LANGS) {
  for (const [device, vp] of Object.entries(DEVICES)) {
    const dir = `store/screenshots/${lang}`; mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor, locale: lang, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept());
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__seedDemo === "function");
    await page.evaluate(() => localStorage.setItem("mock_pro", "1")); // PRO so insights render (web mock store)
    await page.evaluate((l) => window.__seedDemo(l), lang);
    await page.waitForTimeout(2500);
    await page.waitForSelector("button.louder", { timeout: 20000 });
    await page.addStyleTag({ content: ".testmenu{display:none!important}" });
    let n = 0;
    const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${dir}/${device}-${++n}-${name}.png` }); };

    // 1 home: today's gut number being picked, running test card on top
    await page.click(".loud-scale button.l3"); await page.locator(".checkin-card .field").nth(0).locator(".scale button").nth(1).click();
    await page.locator(".checkin-card .field").nth(2).locator(".scale button").nth(3).click();
    await shot("home");
    // 2 meal: usual foods + the FODMAP line
    await page.click(".log-btn.meal"); await page.waitForSelector(".sheet input[type=search]");
    const usual = await page.locator(".sheet .field").nth(1).locator(".chip").elementHandles();
    for (const k of [1, 4, 3]) if (usual[k]) { await usual[k].click(); await page.waitForTimeout(120); }
    await page.waitForTimeout(200); await page.evaluate(() => document.activeElement?.blur());
    await shot("meal");
    await page.click(".sheet-close"); await page.waitForTimeout(250);
    // 3 reintroduction: running test + results
    await page.click(".tabbar button:nth-child(3)"); await page.waitForSelector(".test-card"); await page.evaluate(() => window.scrollTo(0, 0)); await shot("test");
    await page.evaluate(() => window.scrollTo(0, 0));
    // 4 insights: 90-day curve + month bars
    await page.click(".tabbar button:nth-child(4)"); await page.waitForSelector(".bars"); await page.evaluate(() => window.scrollTo(0, 0)); await shot("insights");
    // 5 meals before flare-ups
    await page.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => x.nextElementSibling?.querySelector?.(".meal-pat")); if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 12); }); await shot("patterns");
    await page.evaluate(() => window.scrollTo(0, 0));
    // 6 report sheet
    await page.click(".report-btn"); await page.waitForSelector(".sheet .cta"); await shot("report");
    await page.click(".sheet-close");
    // 7 calendar (not used in store frames)
    await page.click(".tabbar button:nth-child(2)"); await page.waitForSelector(".cal"); await page.click(".cal .day.spike"); await shot("calendar");
    await ctx.close();
    console.log(`${lang}/${device}: ${n} screenshots`);
  }
}
await browser.close();

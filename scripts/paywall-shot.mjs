// App Review screenshot of the paywall (1179×2556, test menu hidden). Needs a dev build on :4173.
// Writes store/review/paywall-en.png and store/screenshots/en/paywall-review.png (the path asc-sync uploads).
import { chromium } from "playwright"; import { mkdirSync, copyFileSync } from "node:fs";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
await p.waitForSelector("h1"); await p.addStyleTag({ content: ".testmenu{display:none!important}" });
await p.selectOption(".onboarding select", "en");
await p.fill(".onboarding input[autocomplete=given-name]", "Anna");
await p.click(".onboarding .cta");
for (let i = 0; i < 5; i++) await p.click(".onboarding .cta");   // 3 intro, widget, setup
await p.click(".onboarding .cta");                                // extras → start → paywall
await p.waitForSelector(".sheet h2", { timeout: 8000 }); await p.waitForTimeout(600);
mkdirSync("store/review", { recursive: true }); mkdirSync("store/screenshots/en", { recursive: true });
await p.screenshot({ path: "store/review/paywall-en.png" }); copyFileSync("store/review/paywall-en.png", "store/screenshots/en/paywall-review.png");
await b.close(); console.log("paywall screenshot ok");

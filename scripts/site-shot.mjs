// Screenshot of a local page (for checking the generated site). Usage: node scripts/site-shot.mjs <url> <out.png> [width]
import { chromium } from "playwright";
const [url, out, w = "390"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); const p = await b.newPage({ viewport: { width: Number(w), height: 900 } });
await p.goto(url, { waitUntil: "networkidle" }); await p.screenshot({ path: out, fullPage: true }); await b.close();

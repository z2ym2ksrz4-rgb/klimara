import { chromium } from "playwright"; import { readFileSync } from "node:fs";
const names = (process.argv[3] ?? "A,B,C,D").split(","); const dir = "resources/candidates/";
const icon = (n, s) => `<div style="width:${s}px;height:${s}px;border-radius:${s * 0.225}px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.25)">${readFileSync(dir + n + ".svg", "utf8").replace("<svg ", `<svg width="${s}" height="${s}" `)}</div>`;
const row = (bg) => `<div style="display:flex;gap:28px;padding:22px;background:${bg};align-items:flex-end">${names.map((n) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px;font:600 14px system-ui;color:${bg === "#fff" ? "#000" : "#fff"}">${icon(n, 120)}${icon(n, 60)}${icon(n, 40)}${n}</div>`).join("")}</div>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); const p = await b.newPage({ viewport: { width: 760, height: 620 } });
await p.setContent(`<body style="margin:0">${row("#fff")}${row("#1c1c1e")}</body>`); await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close();

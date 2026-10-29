#!/usr/bin/env node
// Portfolio download/revenue report: App Store Connect sales reports + Google Play install CSVs
// (Cloud Storage bucket) + RevenueCat overview metrics, for every app in scripts/stats-apps.json.
// Produces a Markdown + HTML report and (optionally) mails it via Resend.
//
// Env (Codemagic workflow "stats"):
//   ASC_STATS_KEY_ID / ASC_STATS_ISSUER_ID / ASC_STATS_PRIVATE_KEY (PEM contents of the .p8)
//       -> an App Store Connect API key with Admin or "Sales and Reports" access (App Manager gets 403 on sales reports).
//          Falls back to APP_STORE_CONNECT_* from the Codemagic integration if unset.
//   ASC_VENDOR_NUMBER            -> App Store Connect > Payments and Financial Reports (top of page)
//   GCLOUD_SERVICE_ACCOUNT_CREDENTIALS -> full JSON key (same as android-release)
//   PLAY_STATS_BUCKET            -> Play Console > Download reports > "Copy Cloud Storage URI" (pubsite_prod_...)
//   REVENUECAT_API_KEY_<NAME>    -> RevenueCat v2 secret key (read-only) per project, NAME = app name upper-cased
//                                   (REVENUECAT_API_KEY_FLYTTEKLAR …); REVENUECAT_API_KEY is used as fallback
//   RESEND_API_KEY, STATS_MAIL_FROM, STATS_MAIL_TO -> optional; without them the report is only written to disk
//   STATS_DAYS (default 7), STATS_OUT (default ./stats-report)
//
// Local run: node scripts/stats.mjs            (needs the env above)
//            node scripts/stats.mjs --demo     (fixture data, no network - for layout/testing)

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const DEMO = process.argv.includes("--demo");
const DAYS = Number(process.env.STATS_DAYS || 7);
const OUT = process.env.STATS_OUT || "stats-report";
const APPS = JSON.parse(fs.readFileSync(new URL("./stats-apps.json", import.meta.url), "utf8"));

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const window = Array.from({ length: DAYS }, (_, i) => iso(addDays(today, -(DAYS - i)))); // yesterday-6 .. yesterday
const warnings = [];
const warn = (m) => { warnings.push(m); console.warn("WARN:", m); };

// ---------- JWT helpers ----------
// Codemagic's App Store Connect integration hands the key over as PEM with literal "\n", as base64, or as a file path.
function loadPem(v) {
  if (!v) return v;
  let k = v.trim().replace(/^@file:/, ""); // Codemagic integrations expose the key as "@file:/path/to/key.p8"
  if (!k.includes("-----BEGIN") && fs.existsSync(k)) k = fs.readFileSync(k, "utf8").trim();
  if (!k.includes("-----BEGIN")) { try { const d = Buffer.from(k, "base64").toString("utf8"); if (d.includes("-----BEGIN")) k = d.trim(); } catch {} }
  k = k.replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!k.includes("-----BEGIN")) k = `-----BEGIN PRIVATE KEY-----\n${k.replace(/\s+/g, "").match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----`;
  return k + "\n";
}
const b64url = (b) => Buffer.from(b).toString("base64url");
function jwt(header, claims, key, alg) {
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.sign(alg === "ES256" ? "sha256" : "RSA-SHA256", Buffer.from(unsigned),
    alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key);
  return `${unsigned}.${b64url(sig)}`;
}

// ---------- App Store Connect: daily sales reports ----------
// Product type identifiers: 1/1F/1T/F1 = first download, 3/3F = redownload, 7/7F/7T = update, IA* = in-app purchase.
const isDownload = (t) => ["1", "1F", "1T", "F1", "1E", "1EP", "1EU"].includes(t);
const isRedownload = (t) => ["3", "3F", "3T", "F3"].includes(t);
const isIap = (t) => t.startsWith("IA");

async function ascFetchDay(date) {
  const e = process.env;
  const iss = e.ASC_STATS_ISSUER_ID || e.APP_STORE_CONNECT_ISSUER_ID, kid = e.ASC_STATS_KEY_ID || e.APP_STORE_CONNECT_KEY_IDENTIFIER;
  const pk = e.ASC_STATS_PRIVATE_KEY || e.APP_STORE_CONNECT_PRIVATE_KEY, vendor = e.ASC_VENDOR_NUMBER;
  const now = Math.floor(Date.now() / 1000);
  const token = jwt({ alg: "ES256", kid, typ: "JWT" }, { iss, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }, loadPem(pk), "ES256");
  const q = new URLSearchParams({
    "filter[frequency]": "DAILY", "filter[reportType]": "SALES", "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": vendor, "filter[reportDate]": date, "filter[version]": "1_1",
  });
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) {
    // Apple uses 404 both for "no sales that day" and "report not generated yet"
    const body = await r.text();
    return /no sales/i.test(body) ? [] : null;
  }
  if (!r.ok) throw new Error(`ASC ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  return parseTsv(text);
}
function parseTsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split("\t");
  return rows.map((l) => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
}
async function ascStats() {
  const perApp = Object.fromEntries(APPS.map((a) => [a.ascAppId, { days: {}, iapDays: {} }]));
  if (DEMO) {
    for (const a of APPS) for (const d of window) { perApp[a.ascAppId].days[d] = Math.floor(Math.random() * 6); perApp[a.ascAppId].iapDays[d] = Math.random() < 0.3 ? 1 : 0; }
    return { perApp, latest: window.at(-1) };
  }
  if (!(process.env.ASC_STATS_PRIVATE_KEY || process.env.APP_STORE_CONNECT_PRIVATE_KEY) || !process.env.ASC_VENDOR_NUMBER) { warn("App Store Connect: missing API key or ASC_VENDOR_NUMBER - skipped"); return { perApp, latest: null }; }
  if (!process.env.ASC_STATS_PRIVATE_KEY) warn("App Store Connect: using the Codemagic integration key - sales reports need an Admin/Sales key in ASC_STATS_* (expect 403 otherwise)");
  let latest = null;
  for (const d of window) {
    let rows;
    try { rows = await ascFetchDay(d); } catch (e) { warn(`App Store Connect ${d}: ${e.message.split("\n")[0].slice(0, 120)}`); if (/403/.test(e.message)) break; continue; }
    if (!rows) continue;
    latest = d;
    for (const a of APPS) { perApp[a.ascAppId].days[d] = 0; perApp[a.ascAppId].iapDays[d] = 0; }
    for (const row of rows) {
      const app = APPS.find((a) => a.ascAppId === (row["Apple Identifier"] || "").trim());
      if (!app) continue;
      const units = Number(row.Units || 0);
      const t = (row["Product Type Identifier"] || "").trim();
      if (isDownload(t) || isRedownload(t)) perApp[app.ascAppId].days[d] += units;
      else if (isIap(t)) perApp[app.ascAppId].iapDays[d] += units;
      // updates (7*) are ignored
    }
  }
  if (!latest) warn("App Store Connect: no daily report available for the window (reports appear ~24 h after the day ends)");
  return { perApp, latest };
}

// ---------- Google Play: installs CSV from the reporting bucket ----------
async function gcsToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/devstorage.read_only",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }, sa.private_key, "RS256");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) throw new Error(`Google token ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).access_token;
}
function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(",").map((c) => c.trim());
  return rows.map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v.trim()])));
}
async function playStats() {
  const perApp = Object.fromEntries(APPS.map((a) => [a.packageName, { days: {}, total: null }]));
  if (DEMO) {
    for (const a of APPS) { for (const d of window) perApp[a.packageName].days[d] = Math.floor(Math.random() * 3); perApp[a.packageName].total = 12; }
    return { perApp, latest: window.at(-1) };
  }
  const bucket = (process.env.PLAY_STATS_BUCKET || "").replace(/^gs:\/\//, "").replace(/\/$/, "");
  if (!process.env.GCLOUD_SERVICE_ACCOUNT_CREDENTIALS || !bucket) { warn("Google Play: missing service account or PLAY_STATS_BUCKET - skipped"); return { perApp, latest: null }; }
  let token;
  try { token = await gcsToken(JSON.parse(process.env.GCLOUD_SERVICE_ACCOUNT_CREDENTIALS)); } catch (e) { warn(`Google Play: ${e.message}`); return { perApp, latest: null }; }
  const months = [...new Set(window.map((d) => d.slice(0, 7).replace("-", "")))];
  let latest = null;
  for (const a of APPS) {
    for (const ym of months) {
      const name = encodeURIComponent(`stats/installs/installs_${a.packageName}_${ym}_overview.csv`);
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${name}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 404) continue; // app has no installs that month yet
      if (!r.ok) { warn(`Google Play ${a.name} ${ym}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      // Play exports are UTF-16LE with BOM
      const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString("utf16le").replace(/^﻿/, "") : buf.toString("utf8").replace(/^﻿/, "");
      for (const row of parseCsv(text)) {
        const d = row.Date;
        if (!d) continue;
        if (window.includes(d)) perApp[a.packageName].days[d] = Number(row["Daily User Installs"] || row["Daily Device Installs"] || 0);
        if (!latest || d > latest) latest = d;
        if (row["Total User Installs"]) perApp[a.packageName].total = Number(row["Total User Installs"]);
      }
    }
  }
  if (!latest) warn("Google Play: no install CSV found (bucket appears once the first app has at least one day of data)");
  return { perApp, latest };
}

// ---------- RevenueCat: overview metrics ----------
async function rcStats() {
  const out = {};
  if (DEMO) { for (const a of APPS) out[a.name] = { new_customers: 9, active_trials: 2, active_subscriptions: 1, mrr: 13.2, revenue: 79 }; return out; }
  for (const a of APPS) {
    if (!a.revenueCatProjectId) { warn(`RevenueCat: ${a.name} has no revenueCatProjectId in stats-apps.json`); continue; }
    const key = process.env[`REVENUECAT_API_KEY_${a.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] || process.env.REVENUECAT_API_KEY;
    if (!key) { warn(`RevenueCat: no REVENUECAT_API_KEY_${a.name.toUpperCase()} set - skipped`); continue; }
    const r = await fetch(`https://api.revenuecat.com/v2/projects/${a.revenueCatProjectId}/metrics/overview`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) { warn(`RevenueCat ${a.name}: ${r.status} ${(await r.text()).slice(0, 200)}`); continue; }
    const m = {};
    for (const x of (await r.json()).metrics || []) m[x.id] = x.value; // ids: active_trials, active_subscriptions, mrr, revenue, new_customers, active_users
    out[a.name] = m;
  }
  return out;
}

// ---------- Report ----------
const sum = (obj, keys) => keys.reduce((s, k) => s + (obj[k] || 0), 0);
const fmt = (n) => (n == null ? "–" : Math.round(n * 100) / 100);

function buildReport({ asc, play, rc }) {
  const yesterday = window.at(-1);
  const rows = APPS.map((a) => {
    const i = asc.perApp[a.ascAppId], g = play.perApp[a.packageName], m = rc[a.name] || {};
    return {
      app: a.name,
      iosDay: asc.latest ? i.days[asc.latest] ?? 0 : null,
      iosWeek: sum(i.days, window),
      iosIap: sum(i.iapDays, window),
      androidDay: play.latest ? g.days[play.latest] ?? 0 : null,
      androidWeek: sum(g.days, window),
      androidTotal: g.total,
      rcNew: m.new_customers, rcTrials: m.active_trials, rcSubs: m.active_subscriptions, rcMrr: m.mrr,
    };
  });
  const totals = rows.reduce((t, r) => ({ iosWeek: t.iosWeek + r.iosWeek, androidWeek: t.androidWeek + r.androidWeek, iosIap: t.iosIap + r.iosIap }), { iosWeek: 0, androidWeek: 0, iosIap: 0 });
  const title = `Ilumie downloads – ${yesterday}`;
  const note = [
    asc.latest ? `iOS "day" = ${asc.latest}` : "iOS: no report yet",
    play.latest ? `Android "day" = ${play.latest}` : "Android: no data yet",
    `week = ${window[0]} … ${yesterday}`,
    "RevenueCat = last 28 days / current",
  ].join(" · ");

  const md = [
    `# ${title}`, "", note, "",
    "| App | iOS day | iOS 7d | iOS IAP 7d | Android day | Android 7d | Android total | RC new 28d | Trials | Subs | MRR |",
    "|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|",
    ...rows.map((r) => `| ${r.app} | ${fmt(r.iosDay)} | ${r.iosWeek} | ${r.iosIap} | ${fmt(r.androidDay)} | ${r.androidWeek} | ${fmt(r.androidTotal)} | ${fmt(r.rcNew)} | ${fmt(r.rcTrials)} | ${fmt(r.rcSubs)} | ${fmt(r.rcMrr)} |`),
    `| **Total** | | **${totals.iosWeek}** | **${totals.iosIap}** | | **${totals.androidWeek}** | | | | | |`,
    "", ...(warnings.length ? ["## Warnings", ...warnings.map((w) => `- ${w}`)] : []),
  ].join("\n");

  const td = (v, b) => `<td style="padding:6px 10px;text-align:right;${b ? "font-weight:600" : ""}">${v}</td>`;
  const html = `<!doctype html><meta charset="utf-8"><body style="font-family:-apple-system,system-ui,sans-serif;color:#1d1d1f;max-width:900px;margin:24px auto;padding:0 16px">
<h2 style="font-weight:600;margin:0 0 4px">${title}</h2>
<p style="color:#6e6e73;font-size:13px;margin:0 0 16px">${note}</p>
<table style="border-collapse:collapse;font-size:14px;width:100%"><thead><tr style="border-bottom:1px solid #d2d2d7;color:#6e6e73;font-size:12px;text-align:right">
<th style="text-align:left;padding:6px 10px">App</th><th>iOS day</th><th>iOS 7d</th><th>IAP 7d</th><th>Android day</th><th>Android 7d</th><th>Android total</th><th>RC new 28d</th><th>Trials</th><th>Subs</th><th>MRR</th></tr></thead><tbody>
${rows.map((r) => `<tr style="border-bottom:1px solid #f0f0f2"><td style="padding:6px 10px;font-weight:600">${r.app}</td>${td(fmt(r.iosDay))}${td(r.iosWeek, 1)}${td(r.iosIap)}${td(fmt(r.androidDay))}${td(r.androidWeek, 1)}${td(fmt(r.androidTotal))}${td(fmt(r.rcNew))}${td(fmt(r.rcTrials))}${td(fmt(r.rcSubs))}${td(fmt(r.rcMrr))}</tr>`).join("\n")}
<tr><td style="padding:6px 10px;font-weight:600">Total</td>${td("")}${td(totals.iosWeek, 1)}${td(totals.iosIap, 1)}${td("")}${td(totals.androidWeek, 1)}${td("")}${td("")}${td("")}${td("")}${td("")}</tr>
</tbody></table>
${warnings.length ? `<h3 style="font-size:14px;margin-top:20px">Warnings</h3><ul style="font-size:13px;color:#6e6e73">${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>` : ""}
<p style="color:#6e6e73;font-size:12px;margin-top:24px">Apple sales reports lag ~24 h; Play install CSVs lag 1–2 days. "day" is the newest day available per store.</p>
</body>`;
  return { title, md, html, subject: `${title}: iOS ${totals.iosWeek} / Android ${totals.androidWeek} downloads (7d)` };
}

async function sendMail({ subject, html, md }) {
  const { RESEND_API_KEY: key, STATS_MAIL_FROM: from, STATS_MAIL_TO: to } = process.env;
  const missing = Object.entries({ RESEND_API_KEY: key, STATS_MAIL_FROM: from, STATS_MAIL_TO: to }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) { console.log("Resend not configured - report is mailed by Codemagic (publishing: email)."); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, html, text: md }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
  console.log(`Mail sent to ${to}`);
}

const [asc, play, rc] = await Promise.all([ascStats(), playStats(), rcStats()]);
const report = buildReport({ asc, play, rc });
fs.mkdirSync(path.dirname(path.resolve(OUT + ".md")), { recursive: true });
fs.writeFileSync(OUT + ".md", report.md);
fs.writeFileSync(OUT + ".html", report.html);
console.log("\n" + report.md + "\n");
if (!DEMO) await sendMail(report);

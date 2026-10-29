// Sync App Store metadata from the repo to App Store Connect via the official API.
// Runs in Codemagic (the API key comes from the App Store Connect integration env vars):
//   APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_KEY_IDENTIFIER, APP_STORE_CONNECT_PRIVATE_KEY
// Usage: node scripts/asc-sync.mjs [--screenshots] [--text] [--iap] [--all]
//   --text         version localizations (description, keywords, promo, what's new) + app name/subtitle per language
//   --screenshots  replace the iPhone 6.9"/6.7" screenshot set per language with store/screenshots/<lang>/store-iphone-6.7-*.png
//   --iap          subscription/IAP localizations, availability and the review screenshot (paywall)
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const APP_ID = process.env.ASC_APP_ID; if (!APP_ID || APP_ID === "TODO") { console.error("Set ASC_APP_ID (codemagic.yaml asc-sync vars)"); process.exit(1); }
const ISSUER = process.env.APP_STORE_CONNECT_ISSUER_ID; const KID = process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
let KEY = process.env.APP_STORE_CONNECT_PRIVATE_KEY ?? (process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH && readFileSync(process.env.APP_STORE_CONNECT_PRIVATE_KEY_PATH, "utf8"));
if (!ISSUER || !KID || !KEY) { console.error("Missing APP_STORE_CONNECT_* env"); process.exit(1); }
console.log("raw key env:", KEY.length, "chars; starts:", JSON.stringify(KEY.slice(0, 12)), "path-like:", existsSync(KEY.trim()));
const keyPath = KEY.trim().replace(/^@file:/, "");
if (existsSync(keyPath)) KEY = readFileSync(keyPath, "utf8");
KEY = KEY.trim().replace(/\\n/g, "\n").replace(/^["']|["']$/g, "");
if (!/-----BEGIN/.test(KEY)) { // raw base64 body (Codemagic sometimes stores the key without PEM armour)
  const body = KEY.replace(/\s+/g, "").match(/.{1,64}/g).join("\n");
  KEY = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}
console.log("key:", KEY.length, "chars,", KEY.split("\n").length, "lines, header:", KEY.split("\n")[0]);
const args = new Set(process.argv.slice(2)); const all = args.has("--all") || args.size === 0;
const DO = { text: all || args.has("--text"), shots: all || args.has("--screenshots"), iap: all || args.has("--iap") };

// ---- auth
const b64url = (s) => Buffer.from(s).toString("base64url");
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KID, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(KEY), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${sig.toString("base64url")}`;
}
const HOST = "https://api.appstoreconnect.apple.com";
async function api(method, path, body, extraHeaders = {}) {
  const url = path.startsWith("http") ? path : path.startsWith("/v2/") ? HOST + path : HOST + "/v1" + path; // IAP v2 resources live under /v2
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json", ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j.errors ?? j).slice(0, 600)}`);
  return j;
}
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---- listing files → fields
const LOCALES = { en: "en-US", da: "da", de: "de-DE", sv: "sv", nb: "no" }; // App Store uses "no" for Norwegian Bokmål
function listing(lang) {
  const md = readFileSync(resolve(`store/listing/${lang}.md`), "utf8");
  const sections = md.split(/^## /m).slice(1).map((s) => { const [head, ...rest] = s.split("\n"); return { head, body: rest.join("\n").trim() }; });
  const [name, subtitleSec, keywords, description, whatsNew, promo] = sections;
  const subtitle = (subtitleSec.body.split("\n").find((l) => /^iOS/i.test(l)) ?? subtitleSec.body.split("\n")[0]).replace(/^iOS[^:]*:\s*/i, "").trim();
  const clip = (s, n) => (s.length > n ? s.slice(0, n) : s);
  return { name: clip(name.body.trim(), 30), subtitle: clip(subtitle, 30), keywords: clip(keywords.body.replace(/\s*\n\s*/g, "").trim(), 100), description: clip(description.body, 4000), whatsNew: clip(whatsNew.body, 4000), promo: clip(promo.body.split("\n")[0].trim(), 170) };
}

// ---- version + localizations
async function currentVersion() {
  const v = await api("GET", `/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED,WAITING_FOR_REVIEW&limit=1`);
  if (!v.data.length) throw new Error("No editable iOS version found");
  return v.data[0];
}
async function ensureVersionLocalization(versionId, locale, fields) {
  const existing = (await api("GET", `/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`)).data;
  // whatsNew is not editable on the very first version of an app (ASC answers 409 STATE_ERROR) — leave it out then.
  const base = { description: fields.description, keywords: fields.keywords, promotionalText: fields.promo, supportUrl: "https://ilumie.com/klimara/support/", marketingUrl: "https://ilumie.com/klimara/" };
  const attrs = firstVersion ? base : { ...base, whatsNew: fields.whatsNew };
  const hit = existing.find((l) => l.attributes.locale === locale);
  if (hit) { if (DO.text) await api("PATCH", `/appStoreVersionLocalizations/${hit.id}`, { data: { id: hit.id, type: "appStoreVersionLocalizations", attributes: attrs } }); return hit.id; }
  const made = await api("POST", `/appStoreVersionLocalizations`, { data: { type: "appStoreVersionLocalizations", attributes: { locale, ...attrs }, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: versionId } } } } });
  return made.data.id;
}
async function ensureAppInfoLocalization(locale, fields) {
  const infos = (await api("GET", `/apps/${APP_ID}/appInfos?limit=5`)).data;
  const info = infos.find((i) => /PREPARE_FOR_SUBMISSION|DEVELOPER_REJECTED|REJECTED|METADATA_REJECTED|WAITING_FOR_REVIEW/.test(i.attributes.appStoreState)) ?? infos[0];
  const locs = (await api("GET", `/appInfos/${info.id}/appInfoLocalizations?limit=50`)).data;
  const hit = locs.find((l) => l.attributes.locale === locale);
  const attrs = { name: fields.name, subtitle: fields.subtitle, privacyPolicyUrl: "https://ilumie.com/klimara/privacy/" };
  if (hit) { await api("PATCH", `/appInfoLocalizations/${hit.id}`, { data: { id: hit.id, type: "appInfoLocalizations", attributes: attrs } }); return; }
  await api("POST", `/appInfoLocalizations`, { data: { type: "appInfoLocalizations", attributes: { locale, ...attrs }, relationships: { appInfo: { data: { type: "appInfos", id: info.id } } } } });
}

// ---- screenshots
async function uploadAsset(createPath, parentType, parentRel, parentId, filePath, extraAttrs = {}) {
  const buf = readFileSync(filePath); const fileName = filePath.split("/").pop();
  const made = await api("POST", createPath, { data: { type: parentType, attributes: { fileName, fileSize: buf.length, ...extraAttrs }, relationships: { [parentRel]: { data: { type: parentRelType(parentRel), id: parentId } } } } });
  const ops = made.data.attributes.uploadOperations;
  for (const op of ops) {
    const chunk = buf.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!r.ok) throw new Error(`upload chunk failed ${r.status}`);
  }
  await api("PATCH", `/${parentType}/${made.data.id}`, { data: { id: made.data.id, type: parentType, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(buf).digest("hex") } } });
  return made.data.id;
}
const parentRelType = (rel) => ({ appScreenshotSet: "appScreenshotSets", subscription: "subscriptions", inAppPurchaseV2: "inAppPurchases" })[rel];

async function syncScreenshots(locId, lang) {
  const dir = resolve(`store/screenshots/${lang}`);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^store-iphone-6\.7-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/(\d+)\.png/)[1]) - Number(b.match(/(\d+)\.png/)[1])) : [];
  if (!files.length) { log(lang, "no screenshots"); return; }
  const sets = (await api("GET", `/appStoreVersionLocalizations/${locId}/appScreenshotSets?limit=20`)).data;
  for (const type of ["APP_IPHONE_67", "APP_IPHONE_65"]) {
    let set = sets.find((s) => s.attributes.screenshotDisplayType === type);
    if (set) { // wipe and refill
      const shots = (await api("GET", `/appScreenshotSets/${set.id}/appScreenshots?limit=20`)).data;
      for (const s of shots) await api("DELETE", `/appScreenshots/${s.id}`);
    } else {
      set = (await api("POST", `/appScreenshotSets`, { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: locId } } } } })).data;
    }
    const src = type === "APP_IPHONE_67" ? files.map((f) => `${dir}/${f}`) : files.map((f) => `${dir}/${f}`.replace("6.7", "6.5")).filter(existsSync);
    if (!src.length) { log(lang, type, "skipped (no files)"); continue; }
    for (const f of src) { await uploadAsset(`/appScreenshots`, "appScreenshots", "appScreenshotSet", set.id, f); log(lang, type, "uploaded", f.split("/").pop()); }
  }
}

// ---- IAP / subscriptions
const SUB_LOC = {
  "en-US": { name: "Klimara Pro – Yearly", description: "Reintroduction planner, patterns, PDF report, PIN", group: "Klimara Pro", lifetimeName: "Klimara Pro – Lifetime", lifetimeDesc: "All Pro features forever. Pay once, no subscription" },
  da: { name: "Klimara Pro – Årligt", description: "Genintroduktionsplan, mønstre, PDF-rapport, PIN", group: "Klimara Pro", lifetimeName: "Klimara Pro – Livstid", lifetimeDesc: "Alle Pro-funktioner for altid. Betal én gang" },
  "de-DE": { name: "Klimara Pro – Jährlich", description: "Wiedereinführungsplan, Muster, PDF-Bericht, PIN", group: "Klimara Pro", lifetimeName: "Klimara Pro – Lebenslang", lifetimeDesc: "Alle Pro-Funktionen für immer. Einmal zahlen" },
  sv: { name: "Klimara Pro – Årsvis", description: "Återintroduktionsplan, mönster, PDF-rapport, PIN", group: "Klimara Pro", lifetimeName: "Klimara Pro – Livstid", lifetimeDesc: "Alla Pro-funktioner för alltid. Betala en gång" },
  no: { name: "Klimara Pro – Årlig", description: "Reintroduksjonsplan, mønstre, PDF-rapport, PIN", group: "Klimara Pro", lifetimeName: "Klimara Pro – Livstid", lifetimeDesc: "Alle Pro-funksjoner for alltid. Betal én gang" },
};
// Localizations of purchases that are already in review are locked by Apple (409 UNMODIFIABLE) — that is expected, not a failure.
const tryIap = async (label, fn) => { try { await fn(); } catch (e) { if (/UNMODIFIABLE/.test(e.message)) { console.log("locked (in review), skipped:", label); return; } console.error("FAILED", label, "→", e.message); iapFailures.push(label); } };
const iapFailures = [];
const c30 = (x) => x.slice(0, 30); const c55 = (x) => x.slice(0, 55);
async function syncIap() {
  const review = resolve("store/screenshots/en/paywall-review.png");
  // subscriptions
  const groups = (await api("GET", `/apps/${APP_ID}/subscriptionGroups?limit=5`)).data;
  for (const g of groups) {
    const gl = (await api("GET", `/subscriptionGroups/${g.id}/subscriptionGroupLocalizations?limit=20`)).data;
    for (const [locale, t] of Object.entries(SUB_LOC)) await tryIap(`group loc ${locale}`, async () => {
      const hit = gl.find((l) => l.attributes.locale === locale);
      if (!hit) await api("POST", `/subscriptionGroupLocalizations`, { data: { type: "subscriptionGroupLocalizations", attributes: { locale, name: t.group, customAppName: "Klimara" }, relationships: { subscriptionGroup: { data: { type: "subscriptionGroups", id: g.id } } } } });
      else if (hit.attributes.state !== "APPROVED") await api("PATCH", `/subscriptionGroupLocalizations/${hit.id}`, { data: { id: hit.id, type: "subscriptionGroupLocalizations", attributes: { name: t.group, customAppName: "Klimara" } } });
    });
    const subs = (await api("GET", `/subscriptionGroups/${g.id}/subscriptions?limit=10`)).data;
    for (const s of subs) {
      const sl = (await api("GET", `/subscriptions/${s.id}/subscriptionLocalizations?limit=20`)).data;
      for (const [locale, t] of Object.entries(SUB_LOC)) await tryIap(`sub loc ${locale}`, async () => {
        const hit = sl.find((l) => l.attributes.locale === locale);
        if (!hit) await api("POST", `/subscriptionLocalizations`, { data: { type: "subscriptionLocalizations", attributes: { locale, name: c30(t.name), description: c55(t.description) }, relationships: { subscription: { data: { type: "subscriptions", id: s.id } } } } });
        else if (hit.attributes.state !== "APPROVED") await api("PATCH", `/subscriptionLocalizations/${hit.id}`, { data: { id: hit.id, type: "subscriptionLocalizations", attributes: { name: c30(t.name), description: c55(t.description) } } });
      });
      const shot = await api("GET", `/subscriptions/${s.id}/appStoreReviewScreenshot`).catch(() => null);
      if (!shot?.data && existsSync(review)) { await uploadAsset(`/subscriptionAppStoreReviewScreenshots`, "subscriptionAppStoreReviewScreenshots", "subscription", s.id, review); log("subscription review screenshot uploaded", s.attributes.productId); }
      log("subscription ok", s.attributes.productId);
    }
  }
  // non-consumable
  const iaps = (await api("GET", `/apps/${APP_ID}/inAppPurchasesV2?limit=10`)).data;
  for (const p of iaps) {
    const pl = (await api("GET", `/v2/inAppPurchases/${p.id}/inAppPurchaseLocalizations?limit=20`)).data;
    for (const [locale, t] of Object.entries(SUB_LOC)) await tryIap(`iap loc ${locale}`, async () => {
      const hit = pl.find((l) => l.attributes.locale === locale);
      if (!hit) await api("POST", `/inAppPurchaseLocalizations`, { data: { type: "inAppPurchaseLocalizations", attributes: { locale, name: c30(t.lifetimeName), description: c55(t.lifetimeDesc) }, relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: p.id } } } } });
      else if (hit.attributes.state !== "APPROVED") await api("PATCH", `/inAppPurchaseLocalizations/${hit.id}`, { data: { id: hit.id, type: "inAppPurchaseLocalizations", attributes: { name: c30(t.lifetimeName), description: c55(t.lifetimeDesc) } } });
    });
    const avail = await api("GET", `/v2/inAppPurchases/${p.id}/iapPriceSchedule`).catch(() => null);
    const availability = await api("GET", `/v2/inAppPurchases/${p.id}/inAppPurchaseAvailability`).catch(() => null);
    if (!availability?.data) {
      await api("POST", `/inAppPurchaseAvailabilities`, { data: { type: "inAppPurchaseAvailabilities", attributes: { availableInNewTerritories: true }, relationships: { inAppPurchase: { data: { type: "inAppPurchases", id: p.id } }, availableTerritories: { data: (await allTerritories()).map((id) => ({ type: "territories", id })) } } } });
      log("iap availability set to all territories", p.attributes.productId);
    }
    if (!avail?.data) log("WARNING: no price schedule for", p.attributes.productId, "— set a price in App Store Connect");
    const shot = await api("GET", `/v2/inAppPurchases/${p.id}/appStoreReviewScreenshot`).catch(() => null);
    if (!shot?.data && existsSync(review)) { await uploadAsset(`/inAppPurchaseAppStoreReviewScreenshots`, "inAppPurchaseAppStoreReviewScreenshots", "inAppPurchaseV2", p.id, review); log("iap review screenshot uploaded", p.attributes.productId); }
    log("iap ok", p.attributes.productId);
  }
  if (iapFailures.length) throw new Error(`iap sub-steps failed: ${iapFailures.join(", ")}`);
}
async function allTerritories() { const out = []; let next = `/territories?limit=200`; while (next) { const r = await api("GET", next); out.push(...r.data.map((t) => t.id)); next = r.links?.next ?? null; } return out; }

// ---- main (every section is independent: one failure is logged and the rest still runs)
const failures = [];
const attempt = async (label, fn) => { try { await fn(); } catch (e) { failures.push(`${label}: ${e.message}`); console.error("FAILED", label, "→", e.message); } };
const version = await currentVersion(); log("version", version.attributes.versionString, version.attributes.appStoreState);
const released = await api("GET", `/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=READY_FOR_SALE,REPLACED_WITH_NEW_VERSION&limit=1`).then((r) => r.data.length > 0).catch(() => false);
const firstVersion = !released; log(firstVersion ? "first version: whatsNew skipped" : "update: whatsNew included");
for (const [lang, locale] of Object.entries(LOCALES)) {
  const fields = listing(lang);
  let locId = null;
  await attempt(`version localization ${locale}`, async () => { locId = await ensureVersionLocalization(version.id, locale, fields); });
  if (DO.text) await attempt(`app info ${locale}`, async () => { await ensureAppInfoLocalization(locale, fields); log("text ok", locale); });
  if (DO.shots && locId) await attempt(`screenshots ${locale}`, () => syncScreenshots(locId, lang));
}
if (DO.iap) await attempt("iap", syncIap);
if (failures.length) { console.error(`\n${failures.length} step(s) failed:\n- ` + failures.join("\n- ")); process.exit(1); }
log("done — everything synced");

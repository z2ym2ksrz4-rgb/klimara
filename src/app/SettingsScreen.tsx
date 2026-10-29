import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { SUPPORTED, type Lang } from "@/core/i18n";
import i18n from "@/core/i18n";
import { exportBackup, importBackup } from "@/core/backup";
import { wipeAllData } from "@/core/db";
import { Sheet, sha256, fmtDate } from "@/core/ui";
import { appVersion } from "@/core/release";
import appConfig from "../../app.config.json";
import { usePurchases, usePaywall, useProGate } from "@/core/purchases";
import { useUi } from "@/domain/klimara/store";
import { InfoSheets } from "@/domain/klimara/screens/InfoSheets";
import { MedicationsSheet } from "@/domain/klimara/screens/Medications";
import { healthAvailable, requestHealthAccess, syncHealth, resetHealthSync } from "@/domain/klimara/health";
import { exportCsv } from "@/domain/klimara/csv";
import { localDay } from "@/core/ui";

export function SettingsScreen() {
  const { t, i18n: i } = useTranslation();
  const s = useSettings();
  const isPro = usePurchases((p) => p.isPro);
  const sub = usePurchases((p) => p.sub);
  const restore = usePurchases((p) => p.restore);
  const manage = usePurchases((p) => p.manage);
  const showPaywall = usePaywall((p) => p.show);
  const gate = useProGate();
  const setMedsOpen = useUi((u) => u.setMedsOpen);
  const openInfo = useUi((u) => u.openInfo);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin1, setPin1] = useState(""); const [pin2, setPin2] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [importText, setImportText] = useState(""); const [importPass, setImportPass] = useState("");
  const [name, setName] = useState(s.userName ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500); };

  const savePin = async () => {
    if (pin1.length !== 6 || pin1 !== pin2) { toast(t("settings.pinMismatch")); return; }
    await s.set("pinHash", await sha256(pin1)); setPinOpen(false); setPin1(""); setPin2(""); toast(t("settings.pinSet"));
  };
  const facts = `${appConfig.appName} ${appVersion} · ${navigator.platform} · ${i18n.language}`;

  return (
    <section className="screen">
      <h1>{t("nav.settings")}</h1>

      <button type="button" className="card tap" style={{ width: "100%", textAlign: "left" }} onClick={() => (isPro ? setPlanOpen(true) : showPaywall("settings"))}>
        <div><strong>{isPro ? t("plan.pro") : t("plan.free")}</strong>
          <div className="muted small">{isPro ? (sub.plan === "lifetime" ? t("settings.planLifetime") : sub.expiresAt ? t("settings.planYearly", { date: fmtDate(sub.expiresAt, i.language) }) : t("settings.proThanks")) : t("settings.freeHint")}</div></div>
        {!isPro ? <span className="pill">{t("plan.upgrade")}</span> : <span className="pill pro">PRO ›</span>}
      </button>

      <h2>{t("settings.profile")}</h2>
      <label className="field"><span>{t("onboarding.name")}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void s.set("userName", name.trim() || null)} placeholder={t("onboarding.namePh")} maxLength={40} />
      </label>
      <label className="field"><span>{t("settings.language")}</span>
        <select value={s.language} onChange={async (e) => { const l = e.target.value as Lang; await s.set("language", l); await i18n.changeLanguage(l); }}>
          {SUPPORTED.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
        </select>
      </label>

      <h2>{t("settings.transition")}</h2>
      <label className="field"><span>{t("onboarding.stageQ")}</span>
        <select value={s.menoStage ?? ""} onChange={(e) => void s.set("menoStage", e.target.value || null)}>
          <option value="">–</option>
          {["regular", "irregular", "none12", "unsure"].map((k) => <option key={k} value={k}>{t(`onboarding.stage.${k}`)}</option>)}
        </select>
      </label>
      <label className="field"><span>{t("onboarding.lastPeriodQ")}</span>
        <input type="date" value={s.lastPeriodDate ?? ""} max={localDay()} onChange={(e) => { void s.set("lastPeriodDate", e.target.value || null); useUi.getState().bump(); }} />
      </label>
      <div className="card"><div><strong>{t("meds.title")}</strong><div className="muted small">{t("meds.settingsHint")}</div></div><button className="ghost" onClick={() => setMedsOpen(true)}>{t("settings.manage")}</button></div>
      {healthAvailable() && (
        <div className="card" style={{ marginTop: 10 }}>
          <div><strong>{t("health.title")} {!isPro && <span className="pill pro">PRO</span>}</strong><div className="muted small">{s.healthExport ? t("health.on") : t("health.hint")}</div></div>
          {s.healthExport
            ? <button className="ghost" onClick={async () => { await s.set("healthExport", false); await resetHealthSync(); toast(t("health.offToast")); }}>{t("common.off")}</button>
            : <button className="ghost" disabled={healthBusy} onClick={async () => {
                if (!gate.allow("health")) return;
                setHealthBusy(true);
                try {
                  const ok = await requestHealthAccess();
                  if (!ok) { toast(t("health.denied")); return; }
                  await s.set("healthExport", true);
                  const n = await syncHealth(); toast(t("health.synced", { n }));
                } finally { setHealthBusy(false); }
              }}>{t("common.on")}</button>}
        </div>
      )}

      <button type="button" className="card tap" style={{ width: "100%", textAlign: "left", marginTop: 10 }} onClick={() => openInfo("redFlags")}>
        <span>{t("redFlags.link")}</span><span className="muted">›</span>
      </button>

      <h2>{t("settings.widget")}</h2>
      <div className="card">
        <div><strong>{t("widget.title")}</strong><div className="muted small">{t("widget.settingsHint")}</div></div>
        <button className="ghost" onClick={() => openInfo("widget")}>{t("widget.guideBtn")}</button>
      </div>

      <h2>{t("settings.reminders")}</h2>
      <label className="check"><input type="checkbox" checked={s.checkinReminder} onChange={(e) => s.set("checkinReminder", e.target.checked)} /> {t("settings.checkinReminder")}</label>
      {s.checkinReminder && (
        <label className="field"><span>{t("settings.reminderTime")}</span>
          <input type="time" value={`${String(s.dailyReminderHour).padStart(2, "0")}:00`} step={3600} onChange={(e) => e.target.value && s.set("dailyReminderHour", Number(e.target.value.slice(0, 2)))} />
        </label>
      )}

      <h2>{t("settings.privacy")}</h2>
      <div className="card">
        <div><strong>{t("settings.pin")}</strong><div className="muted small">{s.pinHash ? t("settings.pinOn") : t("settings.pinOff")}</div></div>
        {s.pinHash
          ? <button className="ghost" onClick={() => { void s.set("pinHash", null); toast(t("settings.pinRemoved")); }}>{t("settings.pinRemove")}</button>
          : <button className="ghost" onClick={() => { if (gate.allow("pin")) setPinOpen(true); }}>{t("settings.pinSetup")}</button>}
      </div>

      <h2>{t("settings.data")}</h2>
      <div className="stack">
        <button className="ghost" onClick={() => { if (!gate.allow("backup")) return; const p = prompt(t("backup.passphrase")); if (p) void exportBackup(p).then(() => toast(t("backup.exported"))); }}>{t("backup.export")}</button>
        <button className="ghost" onClick={() => { if (gate.allow("backup")) setImportOpen(true); }}>{t("backup.import")}</button>
        <button className="ghost" onClick={() => { if (gate.allow("backup")) void exportCsv(t, i.language).then(() => toast(t("csv.done"))); }}>{t("csv.export")}</button>
        <button className="ghost danger" onClick={async () => { if (!confirm(t("backup.wipeConfirm"))) return; await wipeAllData(); alert(t("backup.wiped")); location.reload(); }}>{t("backup.wipe")}</button>
      </div>
      <p className="muted small">{t("settings.dataNote")}</p>

      <h2>{t("settings.about")}</h2>
      <div className="stack">
        <a className="ghost btn-like" style={{ display: "block", padding: 12, borderRadius: 12, textDecoration: "none", textAlign: "center" }} href={`mailto:${appConfig.supportEmail}?subject=${encodeURIComponent(`Feedback ${facts}`)}&body=${encodeURIComponent(`\n\n—\n${facts}`)}`}>{t("settings.feedback")}</a>
        <button className="linklike" onClick={() => void restore().then(() => toast(t("settings.restored")))}>{t("paywall.restore")}</button>
      </div>
      <p className="muted small">
        <a href={appConfig.privacyUrl}>{t("settings.privacyPolicy")}</a> · <a href={appConfig.termsUrl}>{t("paywall.terms")}</a> · <a href={`mailto:${appConfig.supportEmail}`}>{t("settings.support")}</a>
      </p>
      <p className="disclaimer">{t("common.disclaimer")}</p>
      {appVersion && <p className="muted small">{appConfig.appName} {appVersion}</p>}

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title={t("plan.pro")}>
        <div className="card col">
          <strong>{sub.plan === "lifetime" ? t("paywall.plan.lifetime") : t("paywall.plan.annual")}</strong>
          <span className="muted small">
            {sub.plan === "lifetime" ? t("settings.planLifetime")
              : sub.inTrial ? t("settings.planTrial", { date: sub.expiresAt ? fmtDate(sub.expiresAt, i.language) : "–" })
              : sub.willRenew ? t("settings.planRenews", { date: sub.expiresAt ? fmtDate(sub.expiresAt, i.language) : "–" })
              : t("settings.planEnds", { date: sub.expiresAt ? fmtDate(sub.expiresAt, i.language) : "–" })}
          </span>
        </div>
        {sub.plan !== "lifetime" && (
          <>
            <button className="cta" onClick={() => { setPlanOpen(false); showPaywall("switchLifetime"); }}>{t("settings.switchLifetime")}</button>
            <p className="muted small">{t("settings.switchLifetimeHint")}</p>
            <button className="ghost" style={{ width: "100%" }} onClick={() => void manage()}>{t("settings.manageSub")}</button>
          </>
        )}
        <p className="muted small" style={{ marginTop: 12 }}>{t("settings.planStore", { store: sub.store === "APP_STORE" || sub.store === "app_store" ? "App Store" : sub.store === "PLAY_STORE" || sub.store === "play_store" ? "Google Play" : sub.store ?? "–" })}</p>
      </Sheet>
      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title={t("settings.pinSetup")}>
        <p className="muted small">{t("settings.pinHint")}</p>
        <label className="field"><span>{t("settings.pinNew")}</span><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="field"><span>{t("settings.pinRepeat")}</span><input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} /></label>
        <button className="cta" onClick={savePin} disabled={pin1.length !== 6 || pin2.length !== 6}>{t("common.save")}</button>
      </Sheet>
      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title={t("backup.import")}>
        <p className="muted small">{t("backup.importHint")}</p>
        <label className="field"><span>{t("backup.file")}</span><input type="file" accept=".json,.txt,.klimara,*/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setImportText); }} /></label>
        <label className="field"><span>{t("backup.passphraseShort")}</span><input type="password" value={importPass} onChange={(e) => setImportPass(e.target.value)} /></label>
        <button className="cta" disabled={!importText || !importPass} onClick={async () => { try { await importBackup(importText, importPass); setImportOpen(false); toast(t("backup.imported")); useUi.getState().bump(); } catch { toast(t("backup.importFailed")); } }}>{t("backup.import")}</button>
      </Sheet>
      <MedicationsSheet />
      <InfoSheets />
      {msg && <div className="toast">{msg}</div>}
    </section>
  );
}

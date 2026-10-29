import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { ensurePermission } from "@/core/notifications";
import { usePaywall } from "@/core/purchases";
import i18n, { SUPPORTED, type Lang } from "@/core/i18n";
import { haptics } from "@/core/ui";
import { WidgetPreview } from "@/domain/klimara/components/WidgetPreview";
import { localDay } from "@/core/ui";
import { healthAvailable } from "@/domain/klimara/health";

/**
 * Onboarding: (0) language + first name, (1-3) three short intro screens, widget intro, (setup) where in the transition,
 * last period, how long, hormone therapy yes/no – printed on the report – plus when to see a doctor, (extras) Pro wishes.
 * Then notification permission and the paywall (user can always close it and use the free tier).
 */
export function Onboarding() {
  const { t } = useTranslation();
  const settings = useSettings();
  const showPaywall = usePaywall((s) => s.show);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.userName ?? "");
  const [since, setSince] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [lastPeriod, setLastPeriod] = useState("");
  const [hrt, setHrt] = useState<string | null>(null);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [wantHealth, setWantHealth] = useState(false);
  const intro = t("onboarding.steps", { returnObjects: true }) as { title: string; body: string }[];
  const total = intro.length + 4; // name, intro…, widget, setup, extras
  const SETUP = total - 2, EXTRAS = total - 1, WIDGET = intro.length + 1;
  const Dots = () => <div className="dots">{Array.from({ length: total }, (_, i) => <span key={i} className={i === step ? "on" : ""} />)}</div>;

  const finish = async () => {
    await settings.set("userName", name.trim() || null);
    const profile = { stage: stage ?? undefined, since: since ?? undefined, hrt: hrt ?? undefined };
    await settings.set("conditionProfile", stage || since || hrt ? JSON.stringify(profile) : null);
    if (stage) await settings.set("menoStage", stage);
    if (lastPeriod) await settings.set("lastPeriodDate", lastPeriod);
    await settings.set("onboardingWishes", wantHealth ? JSON.stringify({ health: true }) : null);
    await ensurePermission();
    await settings.set("onboardingDone", true);
    showPaywall("onboarding");
  };
  const next = () => { haptics.tap(); setStep(step + 1); };

  if (step === 0) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.welcome")}</h1>
        <p>{t("onboarding.welcomeBody")}</p>
        <label className="field"><span>{t("settings.language")}</span>
          <select value={settings.language} onChange={async (e) => { const l = e.target.value as Lang; await settings.set("language", l); await i18n.changeLanguage(l); }}>
            {SUPPORTED.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t("onboarding.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onboarding.namePh")} autoComplete="given-name" maxLength={40} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === WIDGET) {
    const steps = t("widget.stepsIos", { returnObjects: true }) as string[];
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.widgetTitle")}</h1>
        <p>{t("onboarding.widgetBody")}</p>
        <WidgetPreview />
        <ol className="steps">{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="muted small">{t("onboarding.widgetLater")}</p>
        <div className="row">
          <button className="ghost" onClick={() => setStep(SETUP)}>{t("onboarding.skip")}</button>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === SETUP) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.setupTitle", { name: name.trim() || "" }).trim()}</h1>
        <p className="muted small">{t("onboarding.setupBody")}</p>
        <div className="field"><span>{t("onboarding.stageQ")}</span>
          <div className="chips">{["regular", "irregular", "none12", "unsure"].map((b) => <button key={b} type="button" className={`chip ${stage === b ? "on" : ""}`} onClick={() => setStage(stage === b ? null : b)}>{t(`onboarding.stage.${b}`)}</button>)}</div>
        </div>
        <label className="field"><span>{t("onboarding.lastPeriodQ")}</span>
          <input type="date" value={lastPeriod} max={localDay()} onChange={(e) => setLastPeriod(e.target.value)} />
        </label>
        <div className="field"><span>{t("onboarding.sinceQ")}</span>
          <div className="chips">{["lt1y", "1to3y", "gt3y"].map((b) => <button key={b} type="button" className={`chip ${since === b ? "on" : ""}`} onClick={() => setSince(since === b ? null : b)}>{t(`onboarding.since.${b}`)}</button>)}</div>
        </div>
        <div className="field"><span>{t("onboarding.hrtQ")}</span>
          <div className="chips">{["yes", "no", "considering"].map((b) => <button key={b} type="button" className={`chip ${hrt === b ? "on" : ""}`} onClick={() => setHrt(hrt === b ? null : b)}>{t(`onboarding.hrt.${b}`)}</button>)}</div>
        </div>
        <button type="button" className={`card col tap ${stage === "none12" ? "warn" : ""}`} style={{ width: "100%", textAlign: "left" }} onClick={() => setFlagsOpen(!flagsOpen)}>
          <strong>{t("redFlags.link")}</strong>
          {stage === "none12" && <span className="small">{t("onboarding.bleedAfterHint")}</span>}
          {flagsOpen && <ul className="plain small">{(t("redFlags.urgent", { returnObjects: true }) as string[]).concat(t("redFlags.soon", { returnObjects: true }) as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </button>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === EXTRAS) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.extrasTitle")}</h1>
        <p className="muted">{t("onboarding.extrasBody")}</p>
        {healthAvailable() && (<>
          <label className="check"><input type="checkbox" checked={wantHealth} onChange={(e) => setWantHealth(e.target.checked)} /> {t("health.title")} <span className="pill pro">PRO</span></label>
          <small className="muted" style={{ display: "block", marginTop: -4, marginBottom: 10 }}>{t("health.hint")}</small>
        </>)}
        <p className="muted small" style={{ marginTop: 12 }}>{t("onboarding.extrasNote")}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={() => void finish()}>{t("onboarding.start")}</button>
        </div>
      </section>
    );
  }

  const s = intro[step - 1]!;
  return (
    <section className="screen onboarding">
      <Dots />
      <h1>{s.title}</h1>
      <p>{s.body}</p>
      <div className="row">
        <button className="ghost" onClick={() => setStep(SETUP)}>{t("onboarding.skip")}</button>
        <button className="cta" onClick={next}>{t("onboarding.next")}</button>
      </div>
    </section>
  );
}

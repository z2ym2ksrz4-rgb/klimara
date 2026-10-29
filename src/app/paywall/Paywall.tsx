import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePaywall, usePurchases, type Package } from "@/core/purchases";
import appConfig from "../../../app.config.json";

/**
 * Hard paywall sheet. Shown on demand (useProGate) or at the end of onboarding.
 * Default selection is the annual plan with trial; lifetime is the honest one-time alternative.
 */
export function Paywall() {
  const { t } = useTranslation();
  const { open, reason, hide } = usePaywall();
  const { packages, purchase, restore, ready } = usePurchases();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Package["id"]>("annual");
  if (!open) return null;

  const pkg = packages.find((p) => p.id === selected);
  const buy = async () => {
    if (!pkg) return;
    setBusy(true);
    const ok = await purchase(pkg);
    setBusy(false);
    if (ok) hide();
  };

  return (
    <div className="sheet-backdrop" onClick={hide}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={hide} aria-label={t("common.cancel")}>×</button>
        <h2>{t("paywall.title")}</h2>
        {reason && <p className="muted">{t(`paywall.reasons.${reason}`, { defaultValue: "" })}</p>}
        <ul className="benefits">
          {(t("paywall.benefits", { returnObjects: true }) as string[]).map((b) => <li key={b}>{b}</li>)}
        </ul>
        {!ready ? <p className="muted">…</p> : (
          <div className="plans">
            {packages.map((p) => (
              <button key={p.id} className={`plan ${selected === p.id ? "selected" : ""}`} onClick={() => setSelected(p.id)}>
                <strong>{t(`paywall.plan.${p.id}`)}</strong>
                <span>{p.priceString}</span>
                {p.id === "annual" && p.introPriceString && <em>{t("paywall.trial")}</em>}
              </button>
            ))}
          </div>
        )}
        <button className="cta" disabled={busy || !pkg} onClick={buy}>
          {selected === "annual" ? t("paywall.ctaTrial") : t("paywall.ctaBuy")}
        </button>
        <p className="legal muted">
          {t("paywall.legal")} · <button className="linklike" onClick={() => void restore()}>{t("paywall.restore")}</button> ·{" "}
          <a href={appConfig.termsUrl}>{t("paywall.terms")}</a> · <a href={appConfig.privacyUrl}>{t("settings.privacy")}</a>
        </p>
      </div>
    </div>
  );
}

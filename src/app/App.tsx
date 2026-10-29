import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DomainRoutes, domainTabs, type DomainTab } from "@/domain";
import { SettingsScreen } from "./SettingsScreen";
import { TestMenu } from "./TestMenu";
import { Onboarding } from "./onboarding/Onboarding";
import { Paywall } from "./paywall/Paywall";
import { LockScreen } from "./LockScreen";
import { isRelease } from "@/core/release";
import { useSettings } from "@/core/settings";
import { usePurchases } from "@/core/purchases";

export default function App() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<DomainTab | "settings">(domainTabs[0]!.key);
  const onboardingDone = useSettings((s) => s.onboardingDone);
  const initPurchases = usePurchases((s) => s.init);
  useEffect(() => { void initPurchases(); }, [initPurchases]);
  useEffect(() => { import("@fontsource-variable/fraunces"); }, []);

  return (
    <div className="app">
      <LockScreen />
      <main>
        {!onboardingDone ? <Onboarding /> : tab === "settings" ? <SettingsScreen /> : <DomainRoutes tab={tab} />}
      </main>
      {onboardingDone && (
        <nav className="tabbar">
          {domainTabs.map((d) => (
            <button key={d.key} className={tab === d.key ? "active" : ""} onClick={() => setTab(d.key)}>{t(d.labelKey)}</button>
          ))}
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>{t("nav.settings")}</button>
        </nav>
      )}
      <Paywall />
      {!isRelease && <TestMenu />}
    </div>
  );
}

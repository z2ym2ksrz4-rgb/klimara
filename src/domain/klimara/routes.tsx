import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ensurePermission } from "@/core/notifications";
import { useSettings } from "@/core/settings";
import { Home } from "./screens/Home";
import { Calendar } from "./screens/Calendar";
import { Insights } from "./screens/Insights";
import { EpisodeSheet } from "./screens/EpisodeSheet";
import { MedicationsSheet } from "./screens/Medications";
import { InfoSheets } from "./screens/InfoSheets";
import { replanReminders } from "./reminders";
import { logFlush } from "./data";
import { useUi } from "./store";

export type DomainTab = "home" | "calendar" | "insights";
export const domainTabs: { key: DomainTab; labelKey: string }[] = [
  { key: "home", labelKey: "nav.home" }, { key: "calendar", labelKey: "nav.calendar" }, { key: "insights", labelKey: "nav.insights" },
];

/** Deep link from the widget:  klimara://flush/new  logs a hot flush now and asks "how strong?". */
async function handleUrl(url: string) {
  if (url.includes("flush/new")) { const e = await logFlush(); useUi.getState().bump(); useUi.getState().openEpisode(e.id, "quick"); }
}

export function KlimaraRoutes({ tab }: { tab: DomainTab }) {
  const { t } = useTranslation();
  const version = useUi((s) => s.version);
  const hour = useSettings((s) => s.dailyReminderHour);
  const checkinReminder = useSettings((s) => s.checkinReminder);

  useEffect(() => {
    if (Capacitor.getPlatform() === "web") {
      if (location.hash.startsWith("#klimara://")) void handleUrl(location.hash.slice(1));
      return;
    }
    const sub = CapApp.addListener("appUrlOpen", (e) => void handleUrl(e.url));
    void CapApp.getLaunchUrl().then((l) => { if (l?.url) void handleUrl(l.url); });
    return () => { void sub.then((h) => h.remove()); };
  }, []);
  useEffect(() => { void ensurePermission().then(() => replanReminders(t)); }, [t, version, hour, checkinReminder]);

  return (
    <>
      {tab === "home" && <Home />}
      {tab === "calendar" && <Calendar />}
      {tab === "insights" && <Insights />}
      <EpisodeSheet />
      <MedicationsSheet />
      <InfoSheets />
    </>
  );
}

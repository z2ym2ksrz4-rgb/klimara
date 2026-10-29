import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { TFunction } from "i18next";
import { getCheckin } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";

/**
 * Reminders, re-planned on every start: the evening check-in at the chosen hour (skipped for today if today already
 * has a check-in). Regimen reminders (gel daily, patch every n days) arrive with the treatment screen in phase 3.
 */
export async function replanReminders(t: TFunction) {
  if (Capacitor.getPlatform() === "web") return;
  const s = useSettings.getState();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel(pending);
  const notifs: Parameters<typeof LocalNotifications.schedule>[0]["notifications"] = [];
  const now = new Date();
  if (s.checkinReminder) {
    const todayDone = !!(await getCheckin(localDay()));
    for (let d = 0; d < 30; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, s.dailyReminderHour, 0, 0);
      if (at <= now || (d === 0 && todayDone)) continue;
      notifs.push({ id: 100000 + d, title: t("notif.checkinTitle"), body: t("notif.checkinBody"), schedule: { at }, smallIcon: "ic_stat_notify" });
    }
  }
  if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
}

import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { getDb } from "@/core/db";

/**
 * One daily digest at the user's chosen hour + optional per-item alerts.
 * We schedule at most 60 days ahead and re-plan on every app start (iOS caps pending notifications at 64).
 */
export async function ensurePermission(): Promise<boolean> {
  if (Capacitor.getPlatform() === "web") return false;
  const s = await LocalNotifications.checkPermissions();
  if (s.display === "granted") return true;
  const r = await LocalNotifications.requestPermissions();
  return r.display === "granted";
}

export async function replanAll(dailyHour: number, digestTitle: string, digestBodyFor: (date: Date) => Promise<string | null>) {
  if (Capacitor.getPlatform() === "web") return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel(pending);

  const notifs = [];
  const now = new Date();
  for (let d = 0; d < 60 && notifs.length < 60; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, dailyHour, 0, 0);
    if (at <= now) continue;
    const body = await digestBodyFor(at);
    if (!body) continue;
    notifs.push({ id: 100000 + d, title: digestTitle, body, schedule: { at }, smallIcon: "ic_stat_notify" });
  }
  if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
}

/** Items due on a given day, from the generic reminders table (domain modules write into it). */
export async function remindersOn(date: Date) {
  const day = date.toISOString().slice(0, 10);
  const res = await getDb().query(`SELECT title, body FROM reminders WHERE substr(fireAt,1,10)=? AND delivered=0 ORDER BY fireAt`, [day]);
  return (res.values ?? []) as { title: string; body: string }[];
}

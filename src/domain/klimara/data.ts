import { getDb, dbWrite, newId, nowIso } from "@/core/db";
import { startEpisode, endEpisode, openEpisode, updateEpisode, listEpisodes, listCheckins, type Episode } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { PERIOD_FROM } from "./config";

const q = async <T,>(sql: string, params: unknown[] = []) => ((await getDb().query(sql, params)).values ?? []) as T[];

// ---- hot flushes ------------------------------------------------------------------------------------------------

/**
 * A hot flush is over in minutes, so it is logged closed: start = end = the tap. (The engine's episodes can stay open
 * for migraine; here nothing stays open – a stray open episode from an import is closed first.)
 */
export async function logFlush(at = nowIso(), intensity: number | null = null): Promise<Episode> {
  const open = await openEpisode();
  if (open) await endEpisode(open.id, open.startedAt);
  const e = await startEpisode(at);
  await endEpisode(e.id, at);
  if (intensity != null) await updateEpisode(e.id, { intensity });
  return { ...e, endedAt: at, intensity };
}

/** Local-day bounds as ISO strings for [day, day+1). */
export const dayBounds = (day = localDay()) => {
  const d = new Date(day + "T00:00:00");
  return { fromIso: d.toISOString(), toIso: new Date(d.getTime() + 864e5).toISOString() };
};

/** Flushes per local day in [fromDay, toDay] (inclusive), oldest first; days without flushes are 0. */
export async function flushSeries(fromDay: string, toDay: string): Promise<{ date: string; v: number }[]> {
  const from = new Date(fromDay + "T00:00:00"), to = new Date(toDay + "T00:00:00");
  const eps = await listEpisodes(from.toISOString(), new Date(to.getTime() + 864e5).toISOString());
  const counts = new Map<string, number>();
  for (const e of eps) { const k = localDay(new Date(e.startedAt)); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const out: { date: string; v: number }[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) { const k = localDay(d); out.push({ date: k, v: counts.get(k) ?? 0 }); }
  return out;
}

/** Average flushes per day over the last `days` days vs. the `days` before. */
export async function flushTrend(days = 7): Promise<{ now: number; before: number }> {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return localDay(x); };
  const s = await flushSeries(d(2 * days - 1), d(0));
  const avg = (xs: { v: number }[]) => xs.reduce((a, b) => a + b.v, 0) / (xs.length || 1);
  return { now: avg(s.slice(days)), before: avg(s.slice(0, days)) };
}

// ---- bleeding / last period ---------------------------------------------------------------------------------------

/** The most recent period day: logged bleeding ≥ light, or the date given in onboarding/settings, whichever is later. */
export async function lastPeriodDay(): Promise<string | null> {
  const rows = await listCheckins("2000-01-01", localDay());
  let last: string | null = useSettings.getState().lastPeriodDate;
  for (const c of rows) {
    let b: unknown; try { b = c.extra ? (JSON.parse(c.extra) as Record<string, unknown>).bleed : null; } catch { b = null; }
    if (typeof b === "number" && b >= PERIOD_FROM && (!last || c.date > last)) last = c.date;
  }
  return last;
}

/** Whole days since the last period (null when unknown). */
export async function daysSinceLastPeriod(): Promise<number | null> {
  const last = await lastPeriodDay();
  if (!last) return null;
  const a = new Date(last + "T12:00:00"), b = new Date(localDay() + "T12:00:00");
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 864e5));
}

/** Keeps settings.lastPeriodDate in step when the user logs a period day. */
export async function notePeriodDay(day: string, bleed: number) {
  if (bleed < PERIOD_FROM) return;
  const s = useSettings.getState();
  if (!s.lastPeriodDate || day > s.lastPeriodDate) await s.set("lastPeriodDate", day);
}

// ---- regimens (hormone therapy and other preparations) ------------------------------------------------------------

export type RegimenSchedule = { type: "daily" | "everyNDays"; n?: number; hour: number };
export type Regimen = {
  id: string; name: string; form: string | null; dose: string | null; startDate: string; endDate: string | null;
  schedule: string | null; note: string | null; createdAt: string; updatedAt: string;
};
export const FORMS = ["gel", "patch", "tablet", "spray", "vaginal", "other"] as const;
export const scheduleOf = (r: Regimen): RegimenSchedule | null => { try { return r.schedule ? (JSON.parse(r.schedule) as RegimenSchedule) : null; } catch { return null; } };

export async function listRegimens(): Promise<Regimen[]> { return q<Regimen>(`SELECT * FROM regimen ORDER BY startDate DESC`); }
export async function activeRegimens(day = localDay()): Promise<Regimen[]> {
  return q<Regimen>(`SELECT * FROM regimen WHERE startDate <= ? AND (endDate IS NULL OR endDate >= ?) ORDER BY startDate`, [day, day]);
}
export async function addRegimen(r: { name: string; form?: string | null; dose?: string | null; startDate: string; endDate?: string | null; schedule?: RegimenSchedule | null; note?: string | null }): Promise<string> {
  const id = newId(), now = nowIso();
  await dbWrite(`INSERT INTO regimen(id,name,form,dose,startDate,endDate,schedule,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [id, r.name.trim(), r.form ?? null, r.dose ?? null, r.startDate, r.endDate ?? null, r.schedule ? JSON.stringify(r.schedule) : null, r.note ?? null, now, now]);
  return id;
}
export async function updateRegimen(id: string, patch: Partial<{ name: string; form: string | null; dose: string | null; startDate: string; endDate: string | null; schedule: RegimenSchedule | null; note: string | null }>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[]; if (!keys.length) return;
  const val = (k: keyof typeof patch) => (k === "schedule" ? (patch.schedule ? JSON.stringify(patch.schedule) : null) : (patch[k] ?? null));
  await dbWrite(`UPDATE regimen SET ${keys.map((k) => `${k}=?`).join(", ")}, updatedAt=? WHERE id=?`, [...keys.map(val), nowIso(), id]);
}
export async function deleteRegimen(id: string) { await dbWrite(`DELETE FROM regimen WHERE id=?`, [id]); }

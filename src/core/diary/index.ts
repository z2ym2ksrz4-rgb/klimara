import { getDb, dbWrite, newId, nowIso } from "@/core/db";
import type { DiaryConfig, Episode, Tag, Medication, DailyCheckin, CheckinStatus } from "./types";

export * from "./types";
export { diaryMigrations } from "./migrations";
export { seedMigration } from "./seed";
export * from "./weather";
import { pressurePattern, type PressurePattern } from "./weather";

let config: DiaryConfig | null = null;
/** Called once by the domain before any screen renders. */
export function configureDiary(c: DiaryConfig) { config = c; }
export function diaryConfig(): DiaryConfig {
  if (!config) throw new Error("configureDiary() not called");
  return config;
}

const q = async <T,>(sql: string, params: unknown[] = []) => ((await getDb().query(sql, params)).values ?? []) as T[];

// ---- episodes -------------------------------------------------------------

export async function openEpisode(): Promise<Episode | null> {
  const rows = await q<Episode>(`SELECT * FROM episode WHERE endedAt IS NULL ORDER BY startedAt DESC LIMIT 1`);
  return rows[0] ?? null;
}

/** Starts a new open episode (the "attack now" button). Returns the existing one if one is already open. */
export async function startEpisode(startedAt = nowIso()): Promise<Episode> {
  const open = await openEpisode();
  if (open) return open;
  const id = newId(), now = nowIso();
  await dbWrite(`INSERT INTO episode(id,kind,startedAt,createdAt,updatedAt) VALUES(?,?,?,?,?)`, [id, diaryConfig().episodeKind, startedAt, now, now]);
  return (await q<Episode>(`SELECT * FROM episode WHERE id=?`, [id]))[0];
}

export async function endEpisode(id: string, endedAt = nowIso()) {
  await dbWrite(`UPDATE episode SET endedAt=?, updatedAt=? WHERE id=?`, [endedAt, nowIso(), id]);
}

export async function updateEpisode(id: string, patch: Partial<Pick<Episode, "startedAt" | "endedAt" | "intensity" | "note" | "extra">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  const sets = keys.map((k) => `${k}=?`).join(", ");
  await dbWrite(`UPDATE episode SET ${sets}, updatedAt=? WHERE id=?`, [...keys.map((k) => patch[k] ?? null), nowIso(), id]);
}

export async function deleteEpisode(id: string) {
  await dbWrite(`DELETE FROM episodeTag WHERE episodeId=?`, [id]);
  await dbWrite(`DELETE FROM episode WHERE id=?`, [id]);
}

export async function listEpisodes(fromIso?: string, toIso?: string): Promise<Episode[]> {
  const where: string[] = [], params: unknown[] = [];
  if (fromIso) { where.push(`startedAt >= ?`); params.push(fromIso); }
  if (toIso) { where.push(`startedAt < ?`); params.push(toIso); }
  return q<Episode>(`SELECT * FROM episode ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY startedAt DESC`, params);
}

// ---- tags -----------------------------------------------------------------

export async function listTags(groupKey?: string): Promise<Tag[]> {
  return q<Tag>(
    `SELECT t.*, g.key AS groupKey FROM tag t JOIN tagGroup g ON g.id=t.groupId
     ${groupKey ? "WHERE g.key=?" : ""} ORDER BY g.sort, t.sort, t.label`,
    groupKey ? [groupKey] : [],
  );
}

export async function episodeTagIds(episodeId: string): Promise<string[]> {
  return (await q<{ tagId: string }>(`SELECT tagId FROM episodeTag WHERE episodeId=?`, [episodeId])).map((r) => r.tagId);
}

export async function setEpisodeTags(episodeId: string, tagIds: string[]) {
  const current = new Set(await episodeTagIds(episodeId));
  const wanted = new Set(tagIds);
  for (const id of current) if (!wanted.has(id)) await dbWrite(`DELETE FROM episodeTag WHERE episodeId=? AND tagId=?`, [episodeId, id]);
  for (const id of wanted) if (!current.has(id)) await dbWrite(`INSERT OR IGNORE INTO episodeTag(id,episodeId,tagId,updatedAt) VALUES(?,?,?,?)`, [newId(), episodeId, id, nowIso()]);
  await dbWrite(`UPDATE episode SET updatedAt=? WHERE id=?`, [nowIso(), episodeId]);
}

/** "Other…" → a user tag in that group. */
export async function addUserTag(groupKey: string, label: string): Promise<Tag> {
  const g = (await q<{ id: string }>(`SELECT id FROM tagGroup WHERE key=?`, [groupKey]))[0];
  if (!g) throw new Error(`unknown tag group ${groupKey}`);
  const id = newId();
  const key = `user_${id.slice(0, 8)}`;
  await dbWrite(`INSERT INTO tag(id,groupId,key,labelKey,label,isSystem,isHidden,sort,updatedAt) VALUES(?,?,?,NULL,?,0,0,999,?)`, [id, g.id, key, label.trim(), nowIso()]);
  return (await listTags(groupKey)).find((t) => t.id === id)!;
}

export async function setTagHidden(tagId: string, hidden: boolean) {
  await dbWrite(`UPDATE tag SET isHidden=?, updatedAt=? WHERE id=?`, [hidden ? 1 : 0, nowIso(), tagId]);
}

// ---- medication -----------------------------------------------------------

export async function listMedications(includeHidden = false): Promise<Medication[]> {
  return q<Medication>(`SELECT * FROM medication ${includeHidden ? "" : "WHERE isHidden=0"} ORDER BY sort, name`);
}

export async function addMedication(name: string, kind: Medication["kind"] = "acute", unit: string | null = null): Promise<string> {
  const id = newId();
  await dbWrite(`INSERT INTO medication(id,name,kind,unit,isHidden,sort,updatedAt) VALUES(?,?,?,?,0,0,?)`, [id, name.trim(), kind, unit, nowIso()]);
  return id;
}

export type Intake = { id: string; episodeId: string | null; medicationId: string; takenAt: string; amount: number | null; name: string; kind: string };
export async function listIntakes(episodeId: string): Promise<Intake[]> {
  return q<Intake>(`SELECT i.*, m.name, m.kind FROM medicationIntake i JOIN medication m ON m.id=i.medicationId WHERE i.episodeId=? ORDER BY i.takenAt`, [episodeId]);
}
export async function deleteIntake(id: string) { await dbWrite(`DELETE FROM medicationIntake WHERE id=?`, [id]); }
export async function updateMedication(id: string, patch: Partial<Pick<Medication, "name" | "kind" | "unit" | "isHidden">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return;
  await dbWrite(`UPDATE medication SET ${keys.map((k) => `${k}=?`).join(", ")}, updatedAt=? WHERE id=?`, [...keys.map((k) => patch[k] ?? null), nowIso(), id]);
}

export async function logIntake(medicationId: string, episodeId: string | null, takenAt = nowIso(), amount: number | null = null) {
  await dbWrite(`INSERT INTO medicationIntake(id,episodeId,medicationId,takenAt,amount,updatedAt) VALUES(?,?,?,?,?,?)`, [newId(), episodeId, medicationId, takenAt, amount, nowIso()]);
}

/** Distinct calendar days with at least one acute intake in [fromIso, toIso). The number the warning compares against. */
export async function medicationDays(fromIso: string, toIso: string): Promise<number> {
  const rows = await q<{ n: number }>(
    `SELECT COUNT(DISTINCT substr(i.takenAt,1,10)) AS n FROM medicationIntake i JOIN medication m ON m.id=i.medicationId
     WHERE m.kind='acute' AND i.takenAt >= ? AND i.takenAt < ?`,
    [fromIso, toIso],
  );
  return rows[0]?.n ?? 0;
}

// ---- daily check-in -------------------------------------------------------

export async function getCheckin(date: string): Promise<DailyCheckin | null> {
  return (await q<DailyCheckin>(`SELECT * FROM dailyCheckin WHERE date=?`, [date]))[0] ?? null;
}

export async function setCheckin(date: string, status: CheckinStatus, extra: Record<string, unknown> | null = null, note: string | null = null) {
  const existing = await getCheckin(date);
  if (existing) {
    await dbWrite(`UPDATE dailyCheckin SET status=?, extra=?, note=?, updatedAt=? WHERE id=?`, [status, extra ? JSON.stringify(extra) : null, note, nowIso(), existing.id]);
  } else {
    await dbWrite(`INSERT INTO dailyCheckin(id,date,status,extra,note,updatedAt) VALUES(?,?,?,?,?,?)`, [newId(), date, status, extra ? JSON.stringify(extra) : null, note, nowIso()]);
  }
}

export async function listCheckins(fromDate: string, toDate: string): Promise<DailyCheckin[]> {
  return q<DailyCheckin>(`SELECT * FROM dailyCheckin WHERE date >= ? AND date <= ? ORDER BY date`, [fromDate, toDate]);
}

// ---- stats (descriptive only) --------------------------------------------

/** Distinct calendar days touched by an episode in [fromIso, toIso) — multi-day episodes count every day. */
export async function episodeDays(fromIso: string, toIso: string): Promise<number> {
  const eps = await listEpisodes(fromIso, toIso);
  const days = new Set<string>();
  for (const e of eps) {
    const start = new Date(e.startedAt), end = new Date(e.endedAt ?? nowIso());
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.add(d.toISOString().slice(0, 10));
  }
  return days.size;
}

/** Tag frequency across the episodes in a range: share of episodes carrying each tag, per group. */
export async function tagFrequency(fromIso: string, toIso: string): Promise<{ groupKey: string; tagId: string; labelKey: string | null; label: string | null; n: number; total: number }[]> {
  const total = (await q<{ n: number }>(`SELECT COUNT(*) AS n FROM episode WHERE startedAt >= ? AND startedAt < ?`, [fromIso, toIso]))[0]?.n ?? 0;
  const rows = await q<{ groupKey: string; tagId: string; labelKey: string | null; label: string | null; n: number }>(
    `SELECT g.key AS groupKey, t.id AS tagId, t.labelKey, t.label, COUNT(*) AS n
     FROM episodeTag et JOIN episode e ON e.id=et.episodeId JOIN tag t ON t.id=et.tagId JOIN tagGroup g ON g.id=t.groupId
     WHERE e.startedAt >= ? AND e.startedAt < ? GROUP BY t.id ORDER BY n DESC`, [fromIso, toIso]);
  return rows.map((r) => ({ ...r, total }));
}

/** Per-month episode counts and attack days for the last `months` months, oldest first. */
export async function monthlySeries(months = 12): Promise<{ month: string; episodes: number; attackDays: number }[]> {
  const out: { month: string; episodes: number; attackDays: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { fromIso, toIso } = monthRange(d);
    const episodes = (await q<{ n: number }>(`SELECT COUNT(*) AS n FROM episode WHERE startedAt >= ? AND startedAt < ?`, [fromIso, toIso]))[0]?.n ?? 0;
    out.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, episodes, attackDays: await episodeDays(fromIso, toIso) });
  }
  return out;
}

export async function episodeSummary(fromIso: string, toIso: string) {
  const eps = await listEpisodes(fromIso, toIso);
  const closed = eps.filter((e) => e.endedAt);
  const hours = closed.map((e) => (new Date(e.endedAt!).getTime() - new Date(e.startedAt).getTime()) / 36e5).filter((h) => h >= 0);
  const ints = eps.map((e) => e.intensity).filter((x): x is number => x != null);
  return {
    episodes: eps.length,
    attackDays: await episodeDays(fromIso, toIso),
    avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    avgIntensity: ints.length ? ints.reduce((a, b) => a + b, 0) / ints.length : null,
    medDays: await medicationDays(fromIso, toIso),
  };
}

export const monthRange = (d = new Date()) => {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
};

// ---- added for v1.0 feedback round: journey, streak, patterns, comparison ------------------------

/** All-time usage count per tag (for "your most frequent" in the attack journey). */
export async function tagUsage(): Promise<Record<string, number>> {
  const rows = await q<{ tagId: string; n: number }>(`SELECT tagId, COUNT(*) AS n FROM episodeTag GROUP BY tagId`);
  return Object.fromEntries(rows.map((r) => [r.tagId, r.n]));
}

/** Most recent closed episode end (ISO) or null. */
export async function lastEpisodeEnd(): Promise<string | null> {
  const rows = await q<{ endedAt: string }>(`SELECT endedAt FROM episode WHERE endedAt IS NOT NULL ORDER BY endedAt DESC LIMIT 1`);
  return rows[0]?.endedAt ?? null;
}

/** Whole days since the last episode ended (0 if an episode is open or ended today); null if no episodes at all. */
export async function daysSinceLastEpisode(): Promise<number | null> {
  if (await openEpisode()) return 0;
  const end = await lastEpisodeEnd();
  if (!end) return null;
  const a = new Date(end); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 864e5));
}

/** Medication days for each of the last `months` months, oldest first. */
export async function medDaysByMonth(months = 3): Promise<{ month: string; medDays: number }[]> {
  const out: { month: string; medDays: number }[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { fromIso, toIso } = monthRange(d);
    out.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, medDays: await medicationDays(fromIso, toIso) });
  }
  return out;
}

/** This episode vs. the average of all other closed episodes (duration, intensity). */
export async function episodeComparison(id: string) {
  const eps = await listEpisodes();
  const me = eps.find((e) => e.id === id);
  if (!me) return null;
  const others = eps.filter((e) => e.id !== id && e.endedAt);
  const dur = (e: Episode) => (new Date(e.endedAt!).getTime() - new Date(e.startedAt).getTime()) / 36e5;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    hours: me.endedAt ? dur(me) : null,
    intensity: me.intensity,
    avgHours: avg(others.map(dur).filter((h) => h >= 0)),
    avgIntensity: avg(others.map((e) => e.intensity).filter((x): x is number => x != null)),
    n: others.length,
  };
}

export type Patterns = {
  attacks: number;
  checkins: number;
  /** weekday 0-6 (Sunday=0) with the most attack starts and its share, when it stands out */
  weekday: { day: number; share: number } | null;
  /** part of day with most starts: "night" | "morning" | "afternoon" | "evening" */
  timeOfDay: { part: "night" | "morning" | "afternoon" | "evening"; share: number } | null;
  /** per check-in field: avg the day before an attack day vs. before a calm day */
  fields: { key: string; beforeAttack: number; beforeCalm: number; n: number }[];
  /** share of attacks starting on a period day (±1) when period tracking has data */
  period: { share: number; n: number } | null;
  /** attacks on a falling-pressure day vs. all tracked days (needs weather tracking on) */
  pressure: PressurePattern;
};

/**
 * Descriptive patterns only: where do attacks cluster (weekday, time of day) and how did the night before look.
 * No causality claims — the UI phrases everything as "your attacks have often…".
 */
export async function patterns(days = 180): Promise<Patterns> {
  const from = new Date(Date.now() - days * 864e5).toISOString();
  const eps = await listEpisodes(from);
  const checkins = await listCheckins(from.slice(0, 10), new Date().toISOString().slice(0, 10));
  const res: Patterns = { attacks: eps.length, checkins: checkins.length, weekday: null, timeOfDay: null, fields: [], period: null, pressure: null };
  if (eps.length >= 5) {
    const wd = [0, 0, 0, 0, 0, 0, 0]; const tod = { night: 0, morning: 0, afternoon: 0, evening: 0 };
    for (const e of eps) {
      const d = new Date(e.startedAt); wd[d.getDay()]++;
      const h = d.getHours(); tod[h < 6 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening"]++;
    }
    const bestWd = wd.indexOf(Math.max(...wd));
    if (wd[bestWd] / eps.length >= 0.3) res.weekday = { day: bestWd, share: wd[bestWd] / eps.length };
    const parts = Object.entries(tod) as [keyof typeof tod, number][];
    const bestTod = parts.sort((a, b) => b[1] - a[1])[0];
    if (bestTod[1] / eps.length >= 0.4) res.timeOfDay = { part: bestTod[0], share: bestTod[1] / eps.length };
  }
  if (checkins.length >= 14 && eps.length >= 3) {
    const attackDays = new Set(eps.map((e) => e.startedAt.slice(0, 10)));
    const byDate = new Map(checkins.map((c) => [c.date, c]));
    const keys = diaryConfig().checkinFields.map((f) => f.key);
    for (const k of keys) {
      const before: number[] = [], calm: number[] = [];
      for (const c of checkins) {
        const extra = c.extra ? (JSON.parse(c.extra) as Record<string, number>) : {};
        const v = extra[k]; if (typeof v !== "number") continue;
        const next = new Date(c.date + "T12:00:00"); next.setDate(next.getDate() + 1);
        const nd = next.toISOString().slice(0, 10);
        (attackDays.has(nd) ? before : calm).push(v);
        void byDate;
      }
      if (before.length >= 3 && calm.length >= 5) res.fields.push({ key: k, beforeAttack: before.reduce((a, b) => a + b, 0) / before.length, beforeCalm: calm.reduce((a, b) => a + b, 0) / calm.length, n: before.length });
    }
    const periodDays = new Set(checkins.filter((c) => c.extra && (JSON.parse(c.extra) as Record<string, unknown>).period).map((c) => c.date));
    if (periodDays.size >= 3) {
      const near = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T12:00:00"); for (const off of [-1, 0, 1]) { const x = new Date(d); x.setDate(x.getDate() + off); if (periodDays.has(x.toISOString().slice(0, 10))) return true; } return false; };
      const n = eps.filter((e) => near(e.startedAt)).length;
      res.period = { share: n / eps.length, n };
    }
  }
  res.pressure = await pressurePattern(eps.map((e) => e.startedAt));
  return res;
}

// ---- Apple Health / Health Connect mirror ---------------------------------------------------------------------

/** Closed episodes whose health sample is missing or older than the last edit. */
export async function episodesNeedingHealthSync(): Promise<Episode[]> {
  return q<Episode>(`SELECT * FROM episode WHERE endedAt IS NOT NULL AND (healthSyncedAt IS NULL OR healthSyncedAt < updatedAt) ORDER BY startedAt`);
}

export async function markHealthSynced(id: string, uuid: string | null) {
  // does not bump updatedAt on purpose: that would re-trigger the sync and change backup precedence
  await dbWrite(`UPDATE episode SET healthUuid=?, healthSyncedAt=? WHERE id=?`, [uuid, nowIso(), id]);
}

export async function clearHealthSync() {
  await dbWrite(`UPDATE episode SET healthUuid=NULL, healthSyncedAt=NULL`);
}

// ---- daily values (conditions that are always there: tinnitus, chronic pain …) ----------------------------------

const extraOf = (c: DailyCheckin): Record<string, unknown> => { try { return c.extra ? (JSON.parse(c.extra) as Record<string, unknown>) : {}; } catch { return {}; } };

/** One numeric check-in field per day in [fromDate, toDate] (local YYYY-MM-DD), oldest first. Days without a value are left out. */
export async function checkinSeries(key: string, fromDate: string, toDate: string): Promise<{ date: string; v: number }[]> {
  const out: { date: string; v: number }[] = [];
  for (const c of await listCheckins(fromDate, toDate)) { const v = extraOf(c)[key]; if (typeof v === "number") out.push({ date: c.date, v }); }
  return out;
}

/** Average of a check-in field per calendar month for the last `months` months, oldest first (null = no data). */
export async function checkinMonthly(key: string, months = 12): Promise<{ month: string; avg: number | null; n: number }[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const rows = await checkinSeries(key, `${from.getFullYear()}-${pad(from.getMonth() + 1)}-01`, `${now.getFullYear()}-${pad(now.getMonth() + 1)}-31`);
  const out: { month: string; avg: number | null; n: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const vs = rows.filter((r) => r.date.startsWith(m)).map((r) => r.v);
    out.push({ month: m, avg: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null, n: vs.length });
  }
  return out;
}

export type Contrast = { key: string; lag: 0 | 1; hi: number; lo: number; nHi: number; nLo: number };

/**
 * Descriptive contrast: the average of `target` on days where another field was high vs. low.
 * lag 1 compares with the field's value the day before (e.g. loud noise yesterday → today).
 * High/low = top ~30% / bottom ~40% of that field's own scale. Needs ≥4 days on each side; no statistics beyond that.
 */
export async function checkinContrast(target: string, others: { key: string; lag?: 0 | 1 }[], days = 180): Promise<Contrast[]> {
  const to = new Date(); const from = new Date(Date.now() - days * 864e5);
  const rows = await listCheckins(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
  const byDate = new Map(rows.map((c) => [c.date, extraOf(c)]));
  const fields = diaryConfig().checkinFields;
  const out: Contrast[] = [];
  for (const o of others) {
    const max = fields.find((f) => f.key === o.key)?.max ?? 5;
    const hiCut = Math.ceil(max * 0.7), loCut = Math.floor(max * 0.4);
    const hi: number[] = [], lo: number[] = [];
    for (const [date, ex] of byDate) {
      const tv = ex[target]; if (typeof tv !== "number") continue;
      let src = ex;
      if (o.lag === 1) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - 1); src = byDate.get(d.toISOString().slice(0, 10)) ?? {}; }
      const ov = src[o.key]; if (typeof ov !== "number") continue;
      if (ov >= hiCut) hi.push(tv); else if (ov <= loCut) lo.push(tv);
    }
    if (hi.length >= 4 && lo.length >= 4) out.push({ key: o.key, lag: o.lag ?? 0, hi: hi.reduce((a, b) => a + b, 0) / hi.length, lo: lo.reduce((a, b) => a + b, 0) / lo.length, nHi: hi.length, nLo: lo.length });
  }
  return out;
}

/** Average of a field over the last `days` days vs. the `days` before that (trend line on Home / Insights). */
export async function checkinTrend(key: string, days = 7): Promise<{ now: number | null; before: number | null; nNow: number }> {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const avg = (xs: { v: number }[]) => (xs.length ? xs.reduce((a, b) => a + b.v, 0) / xs.length : null);
  const now = await checkinSeries(key, d(days - 1), d(0));
  const before = await checkinSeries(key, d(2 * days - 1), d(days));
  return { now: avg(now), before: avg(before), nNow: now.length };
}

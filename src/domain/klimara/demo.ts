import { getDb, persist, newId } from "@/core/db";
import { listTags, setCheckin } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { statusFor } from "./config";

/**
 * Demo data for screenshots and smoke tests (dev builds only; wired to window.__seedDemo in main.tsx).
 * Deterministic: 120 days. Before hormone therapy (started 45 days ago) 5–9 hot flushes a day, soaked nights and poor
 * sleep; after the start the flushes taper to 1–3 a day and sleep improves. Irregular periods; the last one 74 days ago.
 */
const NOTES: Record<string, [string, string]> = {
  en: ["In the meeting – had to step out", "Woke up twice"],
  da: ["Midt i mødet – måtte gå ud", "Vågnede to gange"],
  de: ["Mitten im Meeting – musste raus", "Zweimal aufgewacht"],
  sv: ["Mitt i mötet – fick gå ut", "Vaknade två gånger"],
  nb: ["Midt i møtet – måtte gå ut", "Våknet to ganger"],
};
const REGIMEN: Record<string, [string, string]> = {
  en: ["Estradiol gel", "Progesterone"], da: ["Østradiol-gel", "Progesteron"], de: ["Estradiol-Gel", "Progesteron"],
  sv: ["Östradiolgel", "Progesteron"], nb: ["Østradiolgel", "Progesteron"],
};

export async function seedDemo() {
  const db = getDb();
  const lang = useSettings.getState().language;
  const notes = NOTES[lang] ?? NOTES.en;
  const reg = REGIMEN[lang] ?? REGIMEN.en;
  await db.execute(`DELETE FROM episodeTag; DELETE FROM medicationIntake; DELETE FROM episode; DELETE FROM medication; DELETE FROM dailyCheckin; DELETE FROM report; DELETE FROM regimen;`);
  const tags = await listTags();
  const byKey = (g: string, k: string) => tags.find((t) => t.groupKey === g && t.key === k)!.id;
  const now = new Date();
  const dayOf = (ago: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
  const at = (ago: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago, h, m).toISOString();
  const HRT = 45, LAST_PERIOD = 74;

  // treatments
  const start = localDay(dayOf(HRT)), ts = at(HRT, 9);
  await db.run(`INSERT INTO regimen(id,name,form,dose,startDate,endDate,schedule,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [newId(), reg[0], "gel", "1 pump", start, null, JSON.stringify({ type: "daily", hour: 8 }), null, ts, ts], false);
  await db.run(`INSERT INTO regimen(id,name,form,dose,startDate,endDate,schedule,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [newId(), reg[1], "tablet", "100 mg", start, null, JSON.stringify({ type: "daily", hour: 22 }), null, ts, ts], false);

  const triggers = [["coffee"], ["warm_room"], ["stress"], ["alcohol"], ["hot_drink"], ["bedding"], [], ["spicy_food"]];
  const places = ["home", "work", "in_bed", "home", "transport", "work", "in_bed", "social"];
  const reliefs = [["fan"], ["layers_off"], ["cold_water"], ["open_window"], ["fan", "cold_water"], ["breathing"], [], ["layers_off"]];
  const hoursOfDay = [3, 7, 10, 11, 14, 16, 19, 21, 23];
  let k = 0;

  for (let d = 120; d >= 0; d--) {
    const before = d > HRT;
    const taper = before ? 0 : Math.min(1, (HRT - d) / 21); // 3 weeks to settle
    const n = d === 0 ? 2 : Math.max(0, Math.round((before ? 5 + ((d * 7) % 5) : 6 - taper * 4.5 + ((d * 3) % 3) - 1)));
    for (let i = 0; i < n; i++) {
      const h = hoursOfDay[(i * 2 + d) % hoursOfDay.length]!; if (d === 0 && h > now.getHours()) continue;
      const t = at(d, h, (d * 13 + i * 17) % 60), id = newId();
      const intensity = before ? [6, 9, 6, 3, 9][(d + i) % 5]! : [3, 6, 3, 3, 6][(d + i) % 5]!;
      const note = k === 5 ? notes[0] : null;
      await db.run(`INSERT INTO episode(id,kind,startedAt,endedAt,intensity,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)`, [id, "flush", t, t, intensity, note, t, t], false);
      if ((d + i) % 3 !== 0) { // about two in three get details
        const j = k % 8;
        const ids = [...triggers[j]!.map((x) => byKey("trigger", x)), byKey("location", h < 6 || h >= 23 ? "in_bed" : places[j]!), ...reliefs[j]!.map((x) => byKey("relief", x))];
        for (const tid of ids) await db.run(`INSERT OR IGNORE INTO episodeTag(id,episodeId,tagId,updatedAt) VALUES(?,?,?,?)`, [newId(), id, tid, t], false);
      }
      k++;
    }
    if (d === 0 || d % 13 === 5) continue; // today open, a few missed evenings
    const sleep = before ? [2, 3, 2, 1, 3][d % 5]! : Math.min(5, [3, 4, 3, 4, 5][d % 5]! + (taper > 0.8 ? 0 : -1));
    const bleed = d === LAST_PERIOD || d === LAST_PERIOD + 1 ? 3 : d === LAST_PERIOD + 2 ? 2 : d === 112 ? 3 : d === 113 ? 2 : d === 30 ? 1 : 0;
    await setCheckin(localDay(dayOf(d)), statusFor(n), {
      sleep, mood: Math.max(1, Math.min(5, sleep + (before ? 0 : 1) - (d % 4 === 0 ? 1 : 0))),
      energy: Math.max(1, Math.min(5, sleep + (d % 3 === 0 ? -1 : 0))), anxiety: before ? [3, 4, 3, 2][d % 4]! : [2, 2, 1, 3][d % 4]!,
      joints: [2, 3, 2, 2, 3][d % 5]!, fog: before ? [3, 4, 3][d % 3]! : [2, 2, 3][d % 3]!,
      nightSweats: before ? (d % 3 === 0 ? 1 : 2) : d % 4 === 0 ? 1 : 0, bleed,
    }, d === 60 ? notes[1] : null);
  }

  const s = useSettings.getState();
  await s.set("menoStage", "irregular");
  await s.set("lastPeriodDate", localDay(dayOf(LAST_PERIOD)));
  await s.set("conditionProfile", JSON.stringify({ stage: "irregular", since: "1to3y", hrt: "yes" }));
  await persist();
}

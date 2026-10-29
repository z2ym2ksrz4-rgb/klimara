import type { DiaryConfig } from "@/core/diary";
import { klimaraTagGroups } from "./tagsets";

/**
 * Menopause is a stretch of years with good and bad weeks, so two things carry the diary:
 *  - hot flushes as episodes ("Hot flush now" – logged in one tap, details later), counted per day,
 *  - an evening check-in: sleep, mood, energy, anxiety, joints, brain fog (1–5), night sweats (0–2) and bleeding (0–4).
 * Hormone therapy and other preparations are regimens with start/end dates (migration 21), not per-flush intakes.
 */
export const klimaraConfig: DiaryConfig = {
  slug: "klimara",
  episodeKind: "flush",
  tagGroups: klimaraTagGroups,
  checkinFields: [
    { key: "sleep", kind: "scale", max: 5 },
    { key: "mood", kind: "scale", max: 5 },
    { key: "energy", kind: "scale", max: 5 },
    { key: "anxiety", kind: "scale", max: 5 },
    { key: "joints", kind: "scale", max: 5 },
    { key: "fog", kind: "scale", max: 5 },
    { key: "nightSweats", kind: "scale", min: 0, max: 2 },
    { key: "bleed", kind: "scale", min: 0, max: 4 },
  ],
  medicationDayThresholds: [],
  freeHistoryDays: 90,
};

/** The 1–5 scales on the evening check-in, in the order they are asked. */
export const sideFields = ["sleep", "mood", "energy", "anxiety", "joints", "fog"] as const;
export type SideField = (typeof sideFields)[number];
/** Fields where a high number is the good end (shown greener in summaries). */
export const goodHigh: SideField[] = ["sleep", "mood", "energy"];

/** Night sweats: 0 none · 1 some · 2 soaked (changed clothes/bedding). */
export const NIGHT = ["none", "some", "soaked"] as const;
/** Bleeding: 0 none · 1 spotting · 2 light · 3 normal · 4 heavy. "Light" and up counts as a period day. */
export const BLEED = ["none", "spotting", "light", "normal", "heavy"] as const;
export const PERIOD_FROM = 2;

/** Hot flush intensity on the 1–10 scale used by the engine; the quick sheet offers three levels. */
export const FLUSH_LEVELS = [{ v: 3, k: "mild" }, { v: 6, k: "moderate" }, { v: 9, k: "severe" }] as const;
export const levelOf = (i: number | null) => (i == null ? null : i <= 4 ? "mild" : i <= 7 ? "moderate" : "severe");

/** Flushes per day → the engine's day status (calendar tint and "hard day" count). */
export const statusFor = (flushes: number) => (flushes >= 6 ? "attack" : flushes >= 1 ? "mild" : "none") as "none" | "mild" | "attack";
/** Flushes per day → heat class on the calendar. */
export const heatFor = (n: number) => (n <= 0 ? "" : n <= 2 ? "h1" : n <= 5 ? "h2" : n <= 9 ? "h3" : "h4");

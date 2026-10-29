import { Capacitor } from "@capacitor/core";
import { episodesNeedingHealthSync, markHealthSynced, clearHealthSync } from "@/core/diary";
import { useSettings } from "@/core/settings";
import type { HealthSymptomKind } from "health-bridge";

/**
 * Apple Health mirror (iOS only, Pro). Every hot flush becomes one "hot flashes" category sample; intensity 1–4 mild,
 * 5–7 moderate, 8–10 severe. Idempotent: the episode carries the sample uuid + sync time, so edits replace and nothing
 * is written twice. Night sweats from the check-in follow in phase 4. Nothing is ever read from Health.
 */
export const healthAvailable = () => Capacitor.getPlatform() === "ios";

const KIND: HealthSymptomKind = "hotFlashes";
const severity = (i: number | null) => (i == null ? 0 : i <= 4 ? 2 : i <= 7 ? 3 : 4);

export async function requestHealthAccess(): Promise<boolean> {
  if (!healthAvailable()) return false;
  const { HealthBridge } = await import("health-bridge");
  const { available } = await HealthBridge.isAvailable();
  if (!available) return false;
  return (await HealthBridge.requestAuthorization()).granted;
}

/** Write every closed, unsynced (or edited) hot flush. Returns how many samples were written. */
export async function syncHealth(): Promise<number> {
  if (!healthAvailable() || !useSettings.getState().healthExport) return 0;
  const { HealthBridge } = await import("health-bridge");
  let n = 0;
  try {
    for (const e of await episodesNeedingHealthSync()) {
      const end = new Date(Math.max(new Date(e.endedAt!).getTime(), new Date(e.startedAt).getTime() + 2 * 6e4)).toISOString();
      const { uuid } = await HealthBridge.writeSymptom({ kind: KIND, start: e.startedAt, end, severity: severity(e.intensity), replaceUuid: e.healthUuid });
      await markHealthSynced(e.id, uuid); n++;
    }
  } catch (err) { console.warn("[health] sync stopped", err); }
  return n;
}

/** Deleting a flush: remove its sample too (best effort). */
export async function removeHealthSamples(healthUuid: string | null) {
  if (!healthAvailable() || !healthUuid) return;
  try { const { HealthBridge } = await import("health-bridge"); await HealthBridge.deleteSample({ uuid: healthUuid, kind: KIND }); } catch { /* best effort */ }
}

/** Turning the toggle off: forget sync state so a later re-enable writes everything again (samples stay in Health). */
export async function resetHealthSync() { await clearHealthSync(); }

import { useSettings } from "@/core/settings";

/** Pro extras the user asked for during onboarding; applied the moment the account is Pro (trial counts). */
export type Wishes = { health?: boolean };

export async function applyOnboardingWishes(): Promise<void> {
  const s = useSettings.getState();
  if (!s.onboardingWishes) return;
  let w: Wishes = {};
  try { w = JSON.parse(s.onboardingWishes) as Wishes; } catch { /* ignore */ }
  await s.set("onboardingWishes", null); // one shot
  if (w.health) { const { requestHealthAccess } = await import("./health"); if (await requestHealthAccess()) await s.set("healthExport", true); }
}

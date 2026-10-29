import { Capacitor } from "@capacitor/core";
import { useSettings } from "@/core/settings";

/**
 * Ask for a store review right after the user's 2nd "success event" (a completed action that proves value),
 * then at most once per 90 days. Uses the native in-app review dialog so the user never leaves the app.
 * Call `maybeAskForReview()` after incrementing settings.successEvents.
 */
const COOLDOWN_DAYS = 90;
const TRIGGER_AT = 2;

export async function maybeAskForReview() {
  const s = useSettings.getState();
  if (s.successEvents < TRIGGER_AT) return;
  if (s.reviewPromptedAt && Date.now() - new Date(s.reviewPromptedAt).getTime() < COOLDOWN_DAYS * 86_400_000) return;
  if (Capacitor.getPlatform() === "web") { console.info("[review] would prompt now"); await s.set("reviewPromptedAt", new Date().toISOString()); return; }
  try {
    const { InAppReview } = await import("@capacitor-community/in-app-review");
    await InAppReview.requestReview();
    await s.set("reviewPromptedAt", new Date().toISOString());
  } catch (e) { console.warn("[review] not available", e); }
}

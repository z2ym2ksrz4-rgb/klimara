import { Capacitor } from "@capacitor/core";
import type { TFunction } from "i18next";
import appConfig from "../../../app.config.json";

/**
 * Snapshot the home-screen / lock-screen widgets render. Strings are pre-localised here so the native side stays dumb.
 * Published after every Home load (cheap: one JSON write into the app group).
 */
export async function publishWidget(d: { today: number; avg7: number; t: TFunction; lang: string }) {
  if (Capacitor.getPlatform() !== "ios") return;
  try {
    const { WidgetBridge } = await import("widget-bridge");
    const f1 = (n: number) => n.toLocaleString(d.lang, { maximumFractionDigits: 1 });
    const data = {
      cta: d.t("widget.flushNow"),
      open: false,
      line1: d.t("widget.today", { count: d.today }),
      line2: d.t("widget.avg7", { n: f1(d.avg7) }),
      url: "klimara://flush/new",
      updatedAt: new Date().toISOString(),
    };
    await WidgetBridge.setData({ json: JSON.stringify(data), group: `group.${appConfig.appId}`, widgetClass: `${appConfig.appId}.AttackWidget` });
  } catch (e) { console.warn("[widget] publish failed", e); }
}

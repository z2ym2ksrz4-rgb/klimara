import type { PluginListenerHandle } from "@capacitor/core";
export interface WidgetBridgePlugin {
  /** Store a JSON string for the widgets and ask them to reload. `group` is the iOS App Group id; `widgetClass` the Android AppWidgetProvider class name. */
  setData(options: { json: string; group?: string; widgetClass?: string }): Promise<void>;
  /** Build facts the web layer cannot see. */
  info(): Promise<{ isTestFlight: boolean; version: string; build: string; os: string; device: string }>;
  /** Fired when the user takes a screenshot (iOS). */
  addListener(event: "screenshot", cb: () => void): Promise<PluginListenerHandle>;
}
export declare const WidgetBridge: WidgetBridgePlugin;

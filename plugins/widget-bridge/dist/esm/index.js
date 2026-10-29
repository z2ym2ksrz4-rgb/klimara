import { registerPlugin } from "@capacitor/core";
export const WidgetBridge = registerPlugin("WidgetBridge", {
  web: () => Promise.resolve({
    async setData() { /* no widgets on web */ },
    async info() { return { isTestFlight: false, version: "", build: "", os: navigator.userAgent, device: "web" }; },
    async addListener() { return { remove: async () => {} }; },
  }),
});

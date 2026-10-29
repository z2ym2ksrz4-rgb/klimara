import { registerPlugin } from "@capacitor/core";
export const HealthBridge = registerPlugin("HealthBridge", {
  web: () => Promise.resolve({
    async isAvailable() { return { available: false }; },
    async requestAuthorization() { return { granted: false }; },
    async writeSymptom() { return { uuid: "web-" + Math.random().toString(36).slice(2) }; },
    async deleteSample() { /* nothing on web */ },
  }),
});

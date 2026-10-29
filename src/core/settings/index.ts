import { create } from "zustand";
import { getDb, nowIso, dbWrite } from "@/core/db";
import appConfig from "../../../app.config.json";

export type Settings = {
  language: string;            // "en" | "da" | "de" | "sv" | "nb"
  dailyReminderHour: number;   // 0-23
  units: "metric" | "imperial";
  onboardingDone: boolean;
  reviewPromptedAt: string | null;
  successEvents: number;       // used to trigger the review prompt after the 2nd success
  checkinReminder: boolean;    // daily "how was today?" notification
  medThreshold: number;        // medication days per month that triggers the warning (Pro)
  pinHash: string | null;      // sha-256 of the PIN; null = no lock (Pro)
  openEpisodeReminder: boolean;// nudge when an episode has been open > 24h
  userName: string | null;     // first name from onboarding, used for greeting + report
  cycleTracking: boolean;      // Pro: show "period today" on the check-in and the share in insights
  baselineAttacks: string | null; // onboarding answer "attacks per month" bucket (context only)
  widgetGuideSeen: boolean;
  weatherEnabled: boolean;     // Pro: fetch daily air pressure for the chosen place (Open-Meteo, no device location)
  weatherPlace: string | null; // display name of the chosen place
  weatherLat: number | null;
  weatherLon: number | null;
  weatherFetchedAt: string | null;
  healthExport: boolean;       // Pro, iOS: mirror closed attacks to Apple Health as headache samples
  onboardingWishes: string | null; // JSON {cycle,weather,health} chosen in onboarding, applied once the user is Pro
  conditionProfile: string | null; // JSON from onboarding setup (e.g. tinnitus: since, side, sound) – printed on the report
  menoStage: string | null;    // onboarding: "regular" | "irregular" | "none12" | "unsure" – where the user is in the transition
  lastPeriodDate: string | null; // YYYY-MM-DD of the last period (onboarding; moved forward automatically by logged bleeding ≥ light)
};

const defaults: Settings = {
  language: "en",
  dailyReminderHour: appConfig.dailyReminderHour,
  units: "metric",
  onboardingDone: false,
  reviewPromptedAt: null,
  successEvents: 0,
  checkinReminder: true,
  medThreshold: 10,
  pinHash: null,
  openEpisodeReminder: true,
  userName: null,
  cycleTracking: false,
  baselineAttacks: null,
  widgetGuideSeen: false,
  weatherEnabled: false,
  weatherPlace: null,
  weatherLat: null,
  weatherLon: null,
  weatherFetchedAt: null,
  healthExport: false,
  onboardingWishes: null,
  conditionProfile: null,
  menoStage: null,
  lastPeriodDate: null,
};

type Store = Settings & {
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
};

export const useSettings = create<Store>((setState, get) => ({
  ...defaults,
  async load() {
    const res = await getDb().query(`SELECT key, value FROM settings`);
    const patch: Partial<Settings> = {};
    for (const r of res.values ?? []) (patch as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    setState({ ...defaults, ...patch });
  },
  async set(key, value) {
    setState({ [key]: value } as Partial<Settings>);
    await dbWrite(`INSERT OR REPLACE INTO settings(key,value,updatedAt) VALUES(?,?,?)`, [key, JSON.stringify(value), nowIso()]);
    void get; // keep signature stable
  },
}));

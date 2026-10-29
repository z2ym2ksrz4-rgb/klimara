import type { Migration } from "@/core/db/migrations";

/**
 * Symptom-diary engine tables. Generic on purpose: nothing here knows about migraine.
 * A condition (migraine, IBS, tinnitus…) only seeds rows into tagGroup/tag and configures check-in fields.
 * Versions 10–19 are reserved for the engine; the app domain starts at 20.
 * Every table has `id` + `updatedAt` so the core backup/merge (newest wins) works unchanged.
 */
export const diaryMigrations: Migration[] = [
  {
    version: 10,
    name: "diary_episodes_and_tags",
    sql: [
      `CREATE TABLE IF NOT EXISTS episode (
         id TEXT PRIMARY KEY,
         kind TEXT NOT NULL DEFAULT 'attack',
         startedAt TEXT NOT NULL,
         endedAt TEXT,
         intensity INTEGER,
         note TEXT,
         extra TEXT,
         createdAt TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_episode_startedAt ON episode(startedAt);`,
      `CREATE TABLE IF NOT EXISTS tagGroup (
         id TEXT PRIMARY KEY,
         key TEXT NOT NULL UNIQUE,
         kind TEXT NOT NULL,
         sort INTEGER NOT NULL DEFAULT 0,
         isSystem INTEGER NOT NULL DEFAULT 1,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE TABLE IF NOT EXISTS tag (
         id TEXT PRIMARY KEY,
         groupId TEXT NOT NULL,
         key TEXT NOT NULL,
         labelKey TEXT,
         label TEXT,
         isSystem INTEGER NOT NULL DEFAULT 1,
         isHidden INTEGER NOT NULL DEFAULT 0,
         sort INTEGER NOT NULL DEFAULT 0,
         updatedAt TEXT NOT NULL,
         UNIQUE(groupId, key)
       );`,
      `CREATE TABLE IF NOT EXISTS episodeTag (
         id TEXT PRIMARY KEY,
         episodeId TEXT NOT NULL,
         tagId TEXT NOT NULL,
         updatedAt TEXT NOT NULL,
         UNIQUE(episodeId, tagId)
       );`,
      `CREATE INDEX IF NOT EXISTS idx_episodeTag_episode ON episodeTag(episodeId);`,
    ],
  },
  {
    version: 11,
    name: "diary_medication",
    sql: [
      `CREATE TABLE IF NOT EXISTS medication (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         kind TEXT NOT NULL DEFAULT 'acute',
         unit TEXT,
         isHidden INTEGER NOT NULL DEFAULT 0,
         sort INTEGER NOT NULL DEFAULT 0,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE TABLE IF NOT EXISTS medicationIntake (
         id TEXT PRIMARY KEY,
         episodeId TEXT,
         medicationId TEXT NOT NULL,
         takenAt TEXT NOT NULL,
         amount REAL,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_intake_takenAt ON medicationIntake(takenAt);`,
    ],
  },
  {
    version: 12,
    name: "diary_daily_checkin",
    sql: [
      `CREATE TABLE IF NOT EXISTS dailyCheckin (
         id TEXT PRIMARY KEY,
         date TEXT NOT NULL UNIQUE,
         status TEXT NOT NULL DEFAULT 'none',
         extra TEXT,
         note TEXT,
         updatedAt TEXT NOT NULL
       );`,
    ],
  },
  {
    version: 13,
    name: "diary_reports",
    sql: [
      `CREATE TABLE IF NOT EXISTS report (
         id TEXT PRIMARY KEY,
         fromDate TEXT NOT NULL,
         toDate TEXT NOT NULL,
         fileName TEXT,
         createdAt TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
    ],
  },
  {
    version: 14,
    name: "diary_weather_and_health",
    sql: [
      // One row per calendar day with the local air pressure (hPa, mean sea level) and temperature. Filled from
      // Open-Meteo for the place the user picked; no device location is ever read.
      `CREATE TABLE IF NOT EXISTS weatherDay (
         id TEXT PRIMARY KEY,
         date TEXT NOT NULL UNIQUE,
         pressureMean REAL,
         pressureMin REAL,
         pressureMax REAL,
         tempMax REAL,
         updatedAt TEXT NOT NULL
       );`,
      // Apple Health / Health Connect mirror: the sample id we wrote for this episode and when, so edits re-sync.
      `ALTER TABLE episode ADD COLUMN healthUuid TEXT;`,
      `ALTER TABLE episode ADD COLUMN healthSyncedAt TEXT;`,
    ],
  },
];

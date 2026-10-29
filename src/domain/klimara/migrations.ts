import type { Migration } from "@/core/db/migrations";
import { seedMigration } from "@/core/diary";
import { klimaraConfig } from "./config";

/**
 * Engine owns 10–19; Klimara starts at 20. Every table has id + updatedAt so backup merge (newest wins) works unchanged.
 *  20 – seed tags (deterministic ids)
 *  21 – regimen: hormone therapy or another preparation with start/end, used for reminders and the before/after view.
 *       schedule = JSON { type: "daily" | "everyNDays", n?, hour }.
 */
export const klimaraMigrations: Migration[] = [
  seedMigration(20, klimaraConfig),
  {
    version: 21,
    name: "klimara_regimen",
    sql: [
      `CREATE TABLE IF NOT EXISTS regimen (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         form TEXT,
         dose TEXT,
         startDate TEXT NOT NULL,
         endDate TEXT,
         schedule TEXT,
         note TEXT,
         createdAt TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_regimen_start ON regimen(startDate);`,
    ],
  },
];

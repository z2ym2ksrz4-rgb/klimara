/**
 * Database migrations. Append a new entry for every schema change; never edit an old one.
 * Each app adds its own domain tables in src/domain/<app>/migrations.ts and registers them in domain/index.ts.
 */
export type Migration = { version: number; name: string; sql: string[] };

export const coreMigrations: Migration[] = [
  {
    version: 1,
    name: "core_settings_and_meta",
    sql: [
      `CREATE TABLE IF NOT EXISTS meta (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL
       );`,
      `CREATE TABLE IF NOT EXISTS settings (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE TABLE IF NOT EXISTS reminders (
         id TEXT PRIMARY KEY,
         sourceType TEXT NOT NULL,
         sourceId TEXT NOT NULL,
         fireAt TEXT NOT NULL,
         title TEXT NOT NULL,
         body TEXT NOT NULL,
         delivered INTEGER NOT NULL DEFAULT 0
       );`,
      `CREATE INDEX IF NOT EXISTS idx_reminders_fireAt ON reminders(fireAt);`,
    ],
  },
];

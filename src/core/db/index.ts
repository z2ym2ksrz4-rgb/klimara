import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import { coreMigrations, type Migration } from "./migrations";
import { domainMigrations } from "@/domain";

const DB_NAME = "app";
let db: SQLiteDBConnection | null = null;
const sqlite = new SQLiteConnection(CapacitorSQLite);

/** Open the database once and run pending migrations. Call from main.tsx before rendering. */
export async function openDb(): Promise<SQLiteDBConnection> {
  if (db) return db;

  if (Capacitor.getPlatform() === "web") {
    // Web/dev: jeep-sqlite web component backs the same API with sql.js + IndexedDB.
    const jeep = document.querySelector("jeep-sqlite") ?? document.createElement("jeep-sqlite");
    // sql.js wasm lives in public/assets; honour Vite's base so the web build also works under a sub-path.
    (jeep as HTMLElement & { wasmPath?: string }).wasmPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/assets`;
    if (!jeep.isConnected) document.body.appendChild(jeep);
    await customElements.whenDefined("jeep-sqlite");
    await sqlite.initWebStore();
  }

  const consistency = await sqlite.checkConnectionsConsistency();
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  db = consistency.result && exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);

  await db.open();
  await migrate(db, [...coreMigrations, ...domainMigrations]);
  return db;
}

export function getDb(): SQLiteDBConnection {
  if (!db) throw new Error("Database not opened. Call openDb() first.");
  return db;
}

async function migrate(conn: SQLiteDBConnection, all: Migration[]) {
  await conn.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const row = await conn.query(`SELECT value FROM meta WHERE key='schemaVersion'`);
  const current = Number(row.values?.[0]?.value ?? 0);
  const pending = all.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  for (const m of pending) {
    await conn.execute(m.sql.join("\n"));
    await conn.run(`INSERT OR REPLACE INTO meta(key,value) VALUES('schemaVersion', ?)`, [String(m.version)]);
    console.info(`[db] migrated to v${m.version} (${m.name})`);
  }
  if (Capacitor.getPlatform() === "web") await sqlite.saveToStore(DB_NAME);
}

/** Persist to IndexedDB on web after writes (no-op on native). */
export async function persist() {
  if (Capacitor.getPlatform() === "web") await sqlite.saveToStore(DB_NAME);
}

/**
 * All writes go through one queue. SQLite allows a single writer and the plugin wraps every `run` in a
 * transaction, so two overlapping writes (e.g. React StrictMode double effects) would fail with
 * "cannot start a transaction within a transaction". `dbRun` serialises and runs without the implicit transaction.
 */
let chain: Promise<unknown> = Promise.resolve();
export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => undefined);
  return p;
}
export const dbRun = (sql: string, params: unknown[] = []) => serialized(() => getDb().run(sql, params, false));
/** Write + persist, serialised. */
export const dbWrite = (sql: string, params: unknown[] = []) => serialized(async () => { await getDb().run(sql, params, false); await persist(); });

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Settings → Your data → Delete all data. Clears every table except meta (schema version), then reloads. */
export async function wipeAllData() {
  const tables = (await getDb().query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','sqlite_sequence')`)).values ?? [];
  for (const t of tables) await getDb().execute(`DELETE FROM ${t.name}`);
  await persist();
}

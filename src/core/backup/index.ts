import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { getDb, persist, serialized } from "@/core/db";
import appConfig from "../../../app.config.json";

/**
 * Backup = one encrypted JSON file with every table. Used for both backup/restore and household sharing
 * (export on one phone, import on another). Merge rule on import: newest updatedAt per row id wins.
 * Encryption: AES-GCM with a key derived from a user passphrase (PBKDF2). No server involved.
 */
type Dump = { app: string; schemaVersion: number; exportedAt: string; tables: Record<string, Record<string, unknown>[]> };

async function listTables(): Promise<string[]> {
  const r = await getDb().query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'meta'`);
  return (r.values ?? []).map((v) => v.name as string);
}

export async function createDump(): Promise<Dump> {
  const tables: Dump["tables"] = {};
  for (const t of await listTables()) tables[t] = (await getDb().query(`SELECT * FROM ${t}`)).values ?? [];
  const v = await getDb().query(`SELECT value FROM meta WHERE key='schemaVersion'`);
  return { app: appConfig.appSlug, schemaVersion: Number(v.values?.[0]?.value ?? 0), exportedAt: new Date().toISOString(), tables };
}

const buf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: buf(salt), iterations: 200_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptDump(dump: Dump, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const data = new TextEncoder().encode(JSON.stringify(dump));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(data)));
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return JSON.stringify({ v: 1, app: dump.app, salt: b64(salt), iv: b64(iv), data: b64(cipher) });
}

export async function decryptDump(text: string, passphrase: string): Promise<Dump> {
  const env = JSON.parse(text);
  const u8 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await deriveKey(passphrase, u8(env.salt));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(u8(env.iv)) }, key, buf(u8(env.data)));
  return JSON.parse(new TextDecoder().decode(plain));
}

/** Export: write to cache and open the system share sheet (AirDrop, Nearby Share, mail, Files). */
export async function exportBackup(passphrase: string) {
  const payload = await encryptDump(await createDump(), passphrase);
  const path = `${appConfig.appSlug}-backup-${new Date().toISOString().slice(0, 10)}.${appConfig.appSlug}bak`;
  const file = await Filesystem.writeFile({ path, data: payload, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: "Backup", url: file.uri });
}

/** Import with merge: rows are upserted; if both sides have updatedAt, the newer wins. */
export async function importBackup(text: string, passphrase: string) {
  const dump = await decryptDump(text, passphrase);
  if (dump.app !== appConfig.appSlug) throw new Error("backup.wrongApp");
  const db = getDb();
  await serialized(async () => {
  for (const [table, rows] of Object.entries(dump.tables)) {
    for (const row of rows) {
      const cols = Object.keys(row);
      if (!cols.includes("id")) continue;
      const existing = await db.query(`SELECT updatedAt FROM ${table} WHERE id=?`, [row.id]).catch(() => ({ values: [] }));
      const theirs = row.updatedAt as string | undefined;
      const mine = existing.values?.[0]?.updatedAt as string | undefined;
      if (mine && theirs && mine >= theirs) continue;
      const placeholders = cols.map(() => "?").join(",");
      await db.run(`INSERT OR REPLACE INTO ${table}(${cols.join(",")}) VALUES(${placeholders})`, cols.map((c) => row[c]), false);
    }
  }
  await persist();
  });
}

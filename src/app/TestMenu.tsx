import { appVersion } from "@/core/release";
import { getDb, persist } from "@/core/db";
import { usePurchases } from "@/core/purchases";

/** Internal only. Compiled out of release builds via __RELEASE__ (see vite.config.ts). */
export function TestMenu() {
  const isPro = usePurchases((s) => s.isPro);
  const wipe = async () => {
    const tables = (await getDb().query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','sqlite_sequence')`)).values ?? [];
    for (const t of tables) await getDb().execute(`DELETE FROM ${t.name}`);
    try { localStorage.removeItem("mock_pro"); } catch { /* ignore */ }
    await persist(); location.reload();
  };
  const togglePro = () => { try { localStorage.setItem("mock_pro", isPro ? "0" : "1"); } catch { /* ignore */ } location.reload(); };
  return (
    <div className="testmenu">
      <span>DEV v{appVersion} {isPro ? "PRO" : "FREE"}</span>
      <button onClick={togglePro}>Toggle pro</button>
      <button onClick={wipe}>Wipe</button>
    </div>
  );
}

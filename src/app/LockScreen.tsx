import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { sha256 } from "@/core/ui/pin";

/**
 * PIN lock (Pro). Locks on cold start and when the app was in the background for more than a minute.
 * A health diary on a shared or lost phone should not open to anyone — this is the one place we add friction.
 */
export function LockScreen() {
  const { t } = useTranslation();
  const pinHash = useSettings((s) => s.pinHash);
  const [locked, setLocked] = useState(!!pinHash);
  const [entry, setEntry] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => { if (pinHash && locked === false && entry === "" && document.visibilityState === "hidden") setLocked(true); }, [pinHash, locked, entry]);
  useEffect(() => {
    if (!pinHash) { setLocked(false); return; }
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) { setLocked(true); setEntry(""); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pinHash]);

  useEffect(() => {
    if (!locked || entry.length < 6 || !pinHash) return;
    void (async () => {
      if ((await sha256(entry)) === pinHash) { setLocked(false); setEntry(""); }
      else { setShake(true); setTimeout(() => { setShake(false); setEntry(""); }, 400); }
    })();
  }, [entry, locked, pinHash]);

  if (!locked || !pinHash) return null;
  return (
    <div className="lock" style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 80 }}>
      <h1>{t("lock.title")}</h1>
      <div className={`pin ${shake ? "shake" : ""}`}>{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={i < entry.length ? "on" : ""} />)}</div>
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) => (
          <button key={i} disabled={k === ""} style={k === "" ? { visibility: "hidden" } : undefined}
            onClick={() => setEntry((e) => (k === "⌫" ? e.slice(0, -1) : e.length < 6 ? e + k : e))}>{k}</button>
        ))}
      </div>
      <p className="muted small">{t("lock.hint")}</p>
    </div>
  );
}

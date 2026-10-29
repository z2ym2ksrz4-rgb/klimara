import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEpisodes, listCheckins, diaryConfig, type Episode, type DailyCheckin } from "@/core/diary";
import { fmtTime, localDay } from "@/core/ui";
import { useProGate } from "@/core/purchases";
import { useUi } from "../store";
import { sideFields, NIGHT, BLEED, PERIOD_FROM, heatFor, levelOf } from "../config";

type Day = { flushes: Episode[]; extra: Record<string, unknown> | null };

/** Month heatmap: colour = hot flushes that day (0, 1–2, 3–5, 6–9, 10+); a dot marks days with bleeding. Tap a day for its details. */
export function Calendar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const version = useUi((s) => s.version);
  const openSheet = useUi((s) => s.openEpisode);
  const gate = useProGate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [eps, setEps] = useState<Episode[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  const cursorKey = cursor.getTime();
  const { first, last } = useMemo(() => ({ first: new Date(cursorKey), last: new Date(new Date(cursorKey).getFullYear(), new Date(cursorKey).getMonth() + 1, 0) }), [cursorKey]);
  const load = useCallback(async () => {
    setEps(await listEpisodes(first.toISOString(), new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString()));
    setCheckins(await listCheckins(localDay(first), localDay(last)));
  }, [first, last]);
  useEffect(() => { void load(); }, [load, version]);

  const byDay = useMemo(() => {
    const m = new Map<string, Day>();
    const get = (k: string) => m.get(k) ?? { flushes: [], extra: null };
    for (const e of eps) { const k = localDay(new Date(e.startedAt)); const cur = get(k); cur.flushes.push(e); m.set(k, cur); }
    for (const c of checkins) { const cur = get(c.date); try { cur.extra = c.extra ? (JSON.parse(c.extra) as Record<string, unknown>) : {}; } catch { cur.extra = {}; } m.set(c.date, cur); }
    return m;
  }, [eps, checkins]);

  const freeFloor = new Date(); freeFloor.setDate(freeFloor.getDate() - diaryConfig().freeHistoryDays);
  const monthLocked = !gate.isPro && last < freeFloor;
  const go = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const nextLast = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    if (!gate.isPro && nextLast < freeFloor && !gate.allow("history")) return;
    setCursor(next); setSel(null);
  };
  const dow = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, i + 1).toLocaleDateString(lang, { weekday: "short" }).slice(0, 2)); // Mon-first
  const lead = (first.getDay() + 6) % 7;
  const today = localDay();
  const bleedOf = (d?: Day) => (typeof d?.extra?.bleed === "number" ? (d.extra.bleed as number) : 0);
  const cls = (k: string) => { const d = byDay.get(k); if (!d) return ""; return `${heatFor(d.flushes.length)} ${bleedOf(d) >= PERIOD_FROM ? "spike bleed" : ""}`; };
  const selData = sel ? byDay.get(sel) : undefined;

  return (
    <section className="screen">
      <div className="cal-head">
        <button onClick={() => go(-1)} aria-label="prev">‹</button>
        <h1>{cursor.toLocaleDateString(lang, { month: "long", year: "numeric" })}</h1>
        <button onClick={() => go(1)} aria-label="next">›</button>
      </div>
      <div className="cal">
        {dow.map((d, i) => <div key={i} className="dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className="day blank" />)}
        {Array.from({ length: last.getDate() }, (_, i) => {
          const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={k} className={`day ${cls(k)} ${k === today ? "today" : ""} ${sel === k ? "sel" : ""} ${monthLocked ? "locked" : ""}`}
              onClick={() => { if (monthLocked && !gate.allow("history")) return; setSel(sel === k ? null : k); }}>{i + 1}</button>
          );
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--heat-1)" }} />1–2</span><span><i style={{ background: "var(--heat-2)" }} />3–5</span>
        <span><i style={{ background: "var(--heat-3)" }} />6–9</span><span><i style={{ background: "var(--heat-4)" }} />10+</span>
        <span><i className="dot" />{t("calendar.bleeding")}</span>
      </div>
      <p className="muted small">{t("calendar.legend")}</p>

      {sel && (
        <>
          <h2>{new Date(sel + "T12:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</h2>
          {selData?.extra ? (
            <div className="card col">
              <strong>{t("calendar.flushes", { count: selData.flushes.length })}</strong>
              <span className="muted small">{[
                ...sideFields.filter((k) => typeof selData.extra?.[k] === "number").map((k) => `${t(`home.fields.${k}`)} ${selData.extra?.[k] as number}`),
                typeof selData.extra.nightSweats === "number" && selData.extra.nightSweats > 0 ? t(`home.night.${NIGHT[selData.extra.nightSweats as number]}`) : null,
                bleedOf(selData) > 0 ? t(`home.bleed.${BLEED[bleedOf(selData)]}`) : null,
              ].filter(Boolean).join(" · ")}</span>
            </div>
          ) : <p className="muted small">{selData?.flushes.length ? t("calendar.flushes", { count: selData.flushes.length }) + " · " : ""}{t("calendar.noCheckin")}</p>}
          {selData?.flushes.length ? (
            <ul className="list timeline">
              {[...selData.flushes].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((e) => {
                const lv = levelOf(e.intensity);
                return (
                  <li key={e.id} className="tap flush" onClick={() => openSheet(e.id)}>
                    <span className="tl-time">{fmtTime(e.startedAt, lang)}</span>
                    <div className="grow"><strong>{t("episode.title")}</strong><small>{lv ? t(`episode.level.${lv}`) : t("episode.noLevel")}</small></div>
                    <span className="muted">›</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

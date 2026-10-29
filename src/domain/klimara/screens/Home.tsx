import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEpisodes, monthRange, getCheckin, setCheckin, type Episode, type DailyCheckin } from "@/core/diary";
import { haptics, fmtTime, localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { usePurchases } from "@/core/purchases";
import { useUi } from "../store";
import { FlushMark } from "../components/FlushMark";
import { Spark } from "../components/Spark";
import { publishWidget } from "../widget";
import { applyOnboardingWishes } from "../wishes";
import { syncHealth } from "../health";
import { sideFields, NIGHT, BLEED, statusFor, levelOf } from "../config";
import { logFlush, dayBounds, flushSeries, flushTrend, daysSinceLastPeriod, notePeriodDay } from "../data";

type Extra = Record<string, number | boolean>;

/**
 * Home: the "Hot flush now" button first (one tap, the strength is asked after), today's flushes as a timeline,
 * the evening check-in (sleep, mood, energy, anxiety, joints, brain fog, night sweats, bleeding), days since the last
 * period, and the 7-day picture.
 */
export function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const version = useUi((s) => s.version);
  const ui = useUi();
  const isPro = usePurchases((s) => s.isPro);
  const s = useSettings();
  const [todayFlushes, setTodayFlushes] = useState<Episode[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [trend, setTrend] = useState<{ now: number; before: number }>({ now: 0, before: 0 });
  const [series, setSeries] = useState<{ date: string; v: number }[]>([]);
  const [today, setToday] = useState<DailyCheckin | null>(null);
  const [editing, setEditing] = useState(false);
  const [extra, setExtra] = useState<Extra>({});
  const [sincePeriod, setSincePeriod] = useState<number | null>(null);
  const day = localDay();

  const load = useCallback(async () => {
    const { fromIso, toIso } = dayBounds(day);
    const flushes = await listEpisodes(fromIso, toIso); setTodayFlushes(flushes);
    const m = monthRange(); setMonthCount((await listEpisodes(m.fromIso, m.toIso)).length);
    const tr = await flushTrend(7); setTrend(tr);
    const from = new Date(); from.setDate(from.getDate() - 13);
    setSeries(await flushSeries(localDay(from), day));
    const c = await getCheckin(day); setToday(c);
    setExtra(c?.extra ? (JSON.parse(c.extra) as Extra) : {});
    setSincePeriod(await daysSinceLastPeriod());
    void publishWidget({ today: flushes.length, avg7: tr.now, t, lang });
    if (isPro) { await applyOnboardingWishes(); void syncHealth(); }
  }, [day, t, lang, isPro]);
  useEffect(() => { void load(); }, [load, version]);

  const onFlush = async () => { const e = await logFlush(); haptics.thud(); ui.bump(); ui.openEpisode(e.id, "quick"); };
  const hasAny = sideFields.some((k) => typeof extra[k] === "number") || typeof extra.nightSweats === "number" || typeof extra.bleed === "number";
  const saveDay = async () => {
    if (!hasAny) return;
    await setCheckin(day, statusFor(todayFlushes.length), extra, today?.note ?? null);
    if (typeof extra.bleed === "number") await notePeriodDay(day, extra.bleed);
    haptics.success(); setEditing(false); ui.bump();
  };
  const saved = !!today && !editing;
  const f1 = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 });
  const delta = trend.now - trend.before;
  const summary = () => {
    const parts: string[] = [];
    for (const k of sideFields) if (typeof extra[k] === "number") parts.push(`${t(`home.fields.${k}`)} ${extra[k]}`);
    if (typeof extra.nightSweats === "number" && extra.nightSweats > 0) parts.push(t(`home.night.${NIGHT[extra.nightSweats]}`));
    if (typeof extra.bleed === "number" && extra.bleed > 0) parts.push(t(`home.bleed.${BLEED[extra.bleed]}`));
    return parts.join(" · ");
  };

  return (
    <section className="screen">
      <div className="hero">
        <p className="eyebrow">{new Date().toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>{s.userName ? t("home.greeting", { name: s.userName }) : t("home.title")}</h1>
      </div>

      <button type="button" className="louder" onClick={onFlush}>
        <span className="louder-mark"><FlushMark size={34} /></span>
        <span className="col-text"><strong>{t("home.flushNow")}</strong><span className="small">{t("home.flushHint")}</span></span>
      </button>

      <div className="card today-saved">
        <div className="flush-count">{todayFlushes.length}</div>
        <div className="grow"><strong>{t("home.flushesToday", { count: todayFlushes.length })}</strong>
          <div className="muted small">{trend.now > 0 ? t("home.avgLine", { n: f1(trend.now) }) : t("home.noFlushesYet")}</div></div>
      </div>
      {todayFlushes.length > 0 && (
        <ul className="list timeline">
          {todayFlushes.map((e) => {
            const lv = levelOf(e.intensity);
            return (
              <li key={e.id} className="tap flush" onClick={() => ui.openEpisode(e.id, "full")}>
                <span className="tl-time">{fmtTime(e.startedAt, lang)}</span>
                <div className="grow"><strong>{t("episode.title")}</strong><small>{lv ? t(`episode.level.${lv}`) : t("episode.noLevel")}</small></div>
                <span className="muted">›</span>
              </li>
            );
          })}
        </ul>
      )}

      <h2>{t("home.eveningTitle")}</h2>
      {saved ? (
        <div className="card today-saved">
          <div className="grow"><strong>{t("home.savedDay")}</strong>
            <div className="muted small">{summary() || t("home.savedEmpty")}</div></div>
          <button className="ghost" onClick={() => setEditing(true)}>{t("common.edit")}</button>
        </div>
      ) : (
        <div className="card col checkin-card">
          <strong className="q">{t("home.checkinQ")}</strong>
          {sideFields.map((k) => (
            <div className="field" key={k}>
              <span>{t(`home.fields.${k}`)} <em className="muted scale-hint">{t(`home.fieldHint.${k}`)}</em></span>
              <div className="scale">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} className={extra[k] === v ? "on" : ""} onClick={() => { haptics.tap(); setExtra({ ...extra, [k]: v }); }}>{v}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="field night-row"><span>{t("home.nightQ")}</span>
            <div className="chips">{NIGHT.map((k, i) => <button key={k} type="button" className={`chip ${extra.nightSweats === i ? "on" : ""}`} onClick={() => { haptics.tap(); setExtra({ ...extra, nightSweats: i }); }}>{t(`home.night.${k}`)}</button>)}</div>
          </div>
          <div className="field"><span>{t("home.bleedQ")}</span>
            <div className="bleed-row">{BLEED.map((k, i) => <button key={k} type="button" className={`chip ${extra.bleed === i ? "on" : ""}`} onClick={() => { haptics.tap(); setExtra({ ...extra, bleed: i }); }}>{t(`home.bleed.${k}`)}</button>)}</div>
          </div>
          <button className="cta" style={{ marginTop: 6 }} disabled={!hasAny} onClick={saveDay}>{t("home.saveDay")}</button>
        </div>
      )}

      {sincePeriod != null && (
        <div className="card col period-card">
          <span className="eyebrow">{t("home.periodEyebrow")}</span>
          <div className="row tight"><span className="n">{sincePeriod}</span><span className="muted">{t("home.daysSincePeriod", { count: sincePeriod })}</span></div>
          {sincePeriod >= 365 && <span className="small">{t("home.twelveMonths")}</span>}
        </div>
      )}

      <h2>{t("home.weekTitle")}</h2>
      <div className="stats">
        <div className="stat"><div className="n">{f1(trend.now)}</div><div className="l">{t("home.avg7")}</div></div>
        <div className={`stat ${delta <= -0.4 ? "ok" : ""}`}>
          <div className="n">{trend.before === 0 && trend.now === 0 ? "–" : `${delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "→"} ${f1(Math.abs(delta))}`}</div>
          <div className="l">{t("home.vsLastWeek")}</div>
        </div>
        <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="n">{monthCount}</div><div className="l">{t("home.flushesMonth", { count: monthCount })}</div></div>
      </div>
      {series.some((x) => x.v > 0) ? <div className="card spark-card"><Spark data={series} days={14} height={90} lang={lang} max={Math.max(6, ...series.map((x) => x.v))} label={t("home.weekTitle")} /></div>
        : <p className="muted small">{t("home.sparkEmpty")}</p>}

      <button type="button" className="card tap redflag-link" onClick={() => ui.openInfo("redFlags")}>
        <span>{t("redFlags.link")}</span><span className="muted">›</span>
      </button>
      <p className="disclaimer">{t("common.disclaimer")}</p>
    </section>
  );
}

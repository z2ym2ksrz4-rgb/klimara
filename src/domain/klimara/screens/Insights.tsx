import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { tagFrequency, monthRange, patterns as loadPatterns, listCheckins, type Patterns } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useProGate } from "@/core/purchases";
import { useUi } from "../store";
import { Spark } from "../components/Spark";
import { flushSeries } from "../data";

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Descriptive statistics only: counts, averages and shares of what the user logged. No scoring, no advice.
 * Phase 2 shows the core numbers; plain-word observations, before/after treatment and the PDF arrive in phase 4.
 */
export function Insights() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const gate = useProGate();
  const version = useUi((s) => s.version);
  const [range, setRange] = useState<"month" | "3m" | "12m">("3m");
  const [daily, setDaily] = useState<{ date: string; v: number }[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; avg: number }[]>([]);
  const [stats, setStats] = useState<{ perDay: number | null; hard: number; days: number; sleep: number | null; sweatNights: number; checkins: number }>({ perDay: null, hard: 0, days: 0, sleep: null, sweatNights: 0, checkins: 0 });
  const [freq, setFreq] = useState<Awaited<ReturnType<typeof tagFrequency>>>([]);
  const [pat, setPat] = useState<Patterns | null>(null);

  const load = useCallback(async () => {
    if (!gate.isPro) return;
    const now = new Date();
    const d90 = new Date(); d90.setDate(d90.getDate() - 89);
    setDaily(await flushSeries(localDay(d90), localDay()));
    const m12 = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const year = await flushSeries(localDay(m12), localDay());
    const months: { month: string; avg: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const vs = year.filter((x) => x.date.startsWith(key)).map((x) => x.v);
      months.push({ month: key, avg: avgOf(vs) ?? 0 });
    }
    setMonthly(months);
    const n = range === "month" ? 1 : range === "3m" ? 3 : 12;
    const from = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
    const s = await flushSeries(localDay(from), localDay());
    const cs = await listCheckins(localDay(from), localDay());
    const ex = cs.map((c) => { try { return c.extra ? (JSON.parse(c.extra) as Record<string, number>) : {}; } catch { return {}; } });
    setStats({
      perDay: avgOf(s.map((x) => x.v)), hard: s.filter((x) => x.v >= 6).length, days: s.length,
      sleep: avgOf(ex.map((e) => e.sleep).filter((x): x is number => typeof x === "number")),
      sweatNights: ex.filter((e) => typeof e.nightSweats === "number" && e.nightSweats > 0).length, checkins: cs.length,
    });
    setFreq(await tagFrequency(from.toISOString(), monthRange(now).toIso));
    setPat(await loadPatterns());
  }, [gate.isPro, range]);
  useEffect(() => { void load(); }, [load, version]);

  if (!gate.isPro) {
    return (
      <section className="screen">
        <h1>{t("insights.title")}</h1>
        <div className="card col">
          <strong>{t("insights.lockedTitle")}</strong>
          <p className="muted">{t("insights.lockedBody")}</p>
          <button onClick={() => gate.allow("insights")}>{t("plan.upgrade")}</button>
        </div>
      </section>
    );
  }

  const f1 = (n: number | null) => (n == null ? "–" : n.toLocaleString(lang, { maximumFractionDigits: 1 }));
  const maxMonth = Math.max(1, ...monthly.map((m) => m.avg));
  const freqRows = (group: string) => {
    const rows = freq.filter((f) => f.groupKey === group).slice(0, 5);
    if (!rows.length) return <p className="muted small">{t("insights.noData")}</p>;
    return (
      <div className="freq">
        {rows.map((f) => {
          const pct = f.total ? Math.round((f.n / f.total) * 100) : 0;
          return (
            <div className="f" key={f.tagId}>
              <span>{f.labelKey ? t(f.labelKey) : f.label}</span><span className="muted">{pct}%</span>
              <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <section className="screen">
      <h1>{t("insights.title")}</h1>

      <h2>{t("insights.flush90")}</h2>
      {daily.some((x) => x.v > 0) ? <div className="card spark-card"><Spark data={daily} days={90} height={140} lang={lang} max={Math.max(6, ...daily.map((x) => x.v))} label={t("insights.flush90")} /></div> : <p className="muted small">{t("insights.noData")}</p>}
      <p className="muted small">{t("insights.flush90Hint")}</p>

      <h2>{t("insights.monthly")}</h2>
      <div className="bars">
        {monthly.map((m, i) => <div key={m.month} className={`bar ${i === monthly.length - 1 ? "cur" : ""} ${m.avg === 0 ? "none" : ""}`} style={{ height: `${(m.avg / maxMonth) * 100}%` }} title={`${m.month}: ${f1(m.avg)}`} />)}
      </div>
      <div className="barlbl">{monthly.map((m) => <span key={m.month}>{new Date(m.month + "-01T12:00:00").toLocaleDateString(lang, { month: "narrow" })}</span>)}</div>

      <div className="segment" style={{ margin: "16px 0 8px" }}>
        {(["month", "3m", "12m"] as const).map((r) => <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{t(`insights.range.${r}`)}</button>)}
      </div>
      <div className="stats">
        <div className="stat"><div className="n">{f1(stats.perDay)}</div><div className="l">{t("insights.perDay")}</div></div>
        <div className="stat"><div className="n">{stats.hard}</div><div className="l">{t("insights.hardDays", { n: stats.days })}</div></div>
        <div className="stat"><div className="n">{f1(stats.sleep)}</div><div className="l">{t("insights.avgSleep")}</div></div>
        <div className="stat"><div className="n">{stats.sweatNights}</div><div className="l">{t("insights.sweatNights", { n: stats.checkins })}</div></div>
      </div>

      <h2>{t("insights.patterns")}</h2>
      {pat?.weekday || pat?.timeOfDay ? (
        <div className="stack">
          {pat.timeOfDay && <div className="card col"><strong>{t("insights.patTime", { part: t(`insights.part.${pat.timeOfDay.part}`), pct: Math.round(pat.timeOfDay.share * 100) })}</strong><span className="muted small">{t("insights.patBasis", { n: pat.attacks })}</span></div>}
          {pat.weekday && <div className="card col"><strong>{t("insights.patWeekday", { day: new Date(2024, 0, 7 + pat.weekday.day).toLocaleDateString(lang, { weekday: "long" }), pct: Math.round(pat.weekday.share * 100) })}</strong><span className="muted small">{t("insights.patBasis", { n: pat.attacks })}</span></div>}
          <p className="muted small">{t("insights.patNote")}</p>
        </div>
      ) : <p className="muted small">{t("insights.patNeed")}</p>}

      <h2>{t("diary.groups.trigger")} <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>· {t("insights.shareOfFlushes")}</span></h2>
      {freqRows("trigger")}
      <h2>{t("diary.groups.location")}</h2>
      {freqRows("location")}
      <h2>{t("diary.groups.relief")}</h2>
      {freqRows("relief")}
      <p className="disclaimer">{t("insights.disclaimer")}</p>
    </section>
  );
}

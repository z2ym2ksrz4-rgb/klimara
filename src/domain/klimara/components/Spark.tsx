/**
 * Small inline line chart for a daily number (hot flushes per day): points per logged day, a 7-day rolling mean as the line.
 * Days without a value leave a gap in the dots but the rolling mean bridges them. Pure SVG, theme-aware via CSS vars.
 */
export function Spark({ data, days, height = 120, showAxis = true, lang, max = 10, label = "chart" }: { data: { date: string; v: number }[]; days: number; height?: number; showAxis?: boolean; lang: string; max?: number; label?: string }) {
  const W = 320, H = height, P = 6, top = 8, bottom = showAxis ? 18 : 6;
  const end = new Date(); end.setHours(12, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - (days - 1));
  const x = (date: string) => { const d = new Date(date + "T12:00:00"); return P + ((d.getTime() - start.getTime()) / ((days - 1) * 864e5 || 1)) * (W - 2 * P); };
  const y = (v: number) => top + (1 - Math.min(v, max) / max) * (H - top - bottom);
  const byDate = new Map(data.map((d) => [d.date, d.v]));
  const roll: { date: string; v: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const vals: number[] = [];
    for (let k = 0; k < 7; k++) { const e = new Date(d); e.setDate(e.getDate() - k); const v = byDate.get(e.toISOString().slice(0, 10)); if (v != null) vals.push(v); }
    if (vals.length >= 2) roll.push({ date: d.toISOString().slice(0, 10), v: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  const path = roll.map((r, i) => `${i ? "L" : "M"}${x(r.date).toFixed(1)} ${y(r.v).toFixed(1)}`).join(" ");
  const ticks = showAxis ? [0, Math.floor(days / 2), days - 1].map((i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }) : [];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {[0, max / 2, max].map((g) => <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} className="grid" />)}
      {data.map((d) => <circle key={d.date} cx={x(d.date)} cy={y(d.v)} r={days > 45 ? 1.8 : 2.6} className="pt" />)}
      {path && <path d={path} className="line" fill="none" />}
      {ticks.map((d, i) => <text key={i} x={i === 0 ? P : i === 2 ? W - P : W / 2} y={H - 4} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="tick">{d.toLocaleDateString(lang, { day: "numeric", month: "short" })}</text>)}
    </svg>
  );
}

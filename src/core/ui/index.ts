export { Sheet } from "./Sheet";
export * as haptics from "./haptics";
export { sha256 } from "./pin";

export const fmtDate = (iso: string, lang: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(iso).toLocaleDateString(lang, opts);
export const fmtTime = (iso: string, lang: string) => new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (iso: string, lang: string) => `${fmtDate(iso, lang)} ${fmtTime(iso, lang)}`;
/** Local calendar day as YYYY-MM-DD (never toISOString: that shifts the day west of Greenwich). */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** For <input type=datetime-local>. */
export const toLocalInput = (iso: string) => { const d = new Date(iso); return `${localDay(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const fromLocalInput = (v: string) => new Date(v).toISOString();
export const hours = (fromIso: string, toIso: string) => Math.max(0, (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 36e5);

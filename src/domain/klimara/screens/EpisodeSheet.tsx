import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEpisodes, updateEpisode, deleteEpisode, listTags, episodeTagIds, setEpisodeTags, tagUsage, diaryConfig, type Episode, type Tag } from "@/core/diary";
import { Sheet, haptics, fmtTime, toLocalInput, fromLocalInput } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { maybeAskForReview } from "@/core/review";
import { TagPicker } from "../components/TagPicker";
import { useUi } from "../store";
import { removeHealthSamples } from "../health";
import { FLUSH_LEVELS, levelOf } from "../config";

/**
 * The hot-flush sheet in three tempos (log now, details later – playbook #41):
 *  - quick   : right after "Hot flush now" – one question (how strong?), then it closes. A link offers the details.
 *  - journey : what set it off, where you were, what helped, a note – three chips steps with your most used first, all skippable.
 *  - full    : the complete editable form (time, strength, all chips, note, delete).
 * A hot flush is logged closed (start = end); there is no "ongoing" state.
 */
export function EpisodeSheet() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const id = useUi((s) => s.episodeSheetId);
  const mode = useUi((s) => s.episodeSheetMode);
  const setMode = useUi((s) => s.setMode);
  const close = useUi((s) => s.closeEpisode);
  const bump = useUi((s) => s.bump);
  const settings = useSettings();
  const [ep, setEp] = useState<Episode | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const e = (await listEpisodes()).find((x) => x.id === id) ?? null;
    setEp(e); setNote(e?.note ?? "");
    setTags(await listTags()); setSel(new Set(await episodeTagIds(id))); setUsage(await tagUsage());
  }, [id]);
  useEffect(() => { void load(); setConfirmDelete(false); setStep(0); setExpanded({}); }, [load]);

  const groups = diaryConfig().tagGroups;
  const steps = useMemo(() => [...["trigger", "location", "relief"].filter((k) => groups.some((g) => g.key === k)).map((k) => `tags:${k}`), "note"], [groups]);

  if (!id || !ep) return null;
  const patch = async (p: Parameters<typeof updateEpisode>[1]) => { await updateEpisode(ep.id, p); setEp({ ...ep, ...p } as Episode); bump(); };
  const onTags = async (n: Set<string>) => { setSel(n); await setEpisodeTags(ep.id, [...n]); bump(); };
  const toggleTag = (tid: string) => { const n = new Set(sel); if (n.has(tid)) n.delete(tid); else n.add(tid); haptics.tap(); void onTags(n); };
  const onDelete = async () => { void removeHealthSamples(ep.healthUuid); await deleteEpisode(ep.id); bump(); close(); };
  const counted = async () => { await settings.set("successEvents", settings.successEvents + 1); void maybeAskForReview(); };
  const title = `${t("episode.title")} · ${fmtTime(ep.startedAt, lang)}`;

  // ---- quick: one question ------------------------------------------------------------------------------------
  if (mode === "quick") {
    const pick = async (v: number) => { await patch({ intensity: v }); haptics.thud(); void counted(); close(); };
    return (
      <Sheet open onClose={close} title={t("episode.logged")}>
        <p className="muted">{t("episode.quickIntro")}</p>
        <h3 style={{ marginTop: 14 }}>{t("episode.howStrong")}</h3>
        <div className="bigchoice">
          {FLUSH_LEVELS.map((o) => (
            <button key={o.k} type="button" className={`big ${o.k}`} onClick={() => pick(o.v)}>{t(`episode.level.${o.k}`)}</button>
          ))}
        </div>
        <div className="row between" style={{ marginTop: 16 }}>
          <button type="button" className="linklike" onClick={close}>{t("episode.laterLink")}</button>
          <button type="button" className="linklike" onClick={() => { setStep(0); setMode("journey"); }}>{t("episode.addDetails")}</button>
        </div>
      </Sheet>
    );
  }

  // ---- journey: trigger → where → what helped → note ----------------------------------------------------------
  if (mode === "journey") {
    const cur = steps[step]!;
    const next = () => { haptics.tap(); if (step < steps.length - 1) setStep(step + 1); else close(); };
    const dots = <div className="dots" style={{ marginBottom: 6 }}>{steps.map((s, i) => <span key={s} className={i === step ? "on" : i < step ? "done" : ""} />)}</div>;
    const nav = (
      <div className="row between" style={{ marginTop: 18 }}>
        <button type="button" className="linklike" onClick={() => setMode("full")}>{t("episode.editAll")}</button>
        <div className="row tight">
          {step < steps.length - 1 && <button type="button" className="ghost" onClick={next}>{t("episode.skip")}</button>}
          <button type="button" onClick={next}>{step === steps.length - 1 ? t("common.done") : t("onboarding.next")}</button>
        </div>
      </div>
    );
    if (cur.startsWith("tags:")) {
      const gk = cur.slice(5);
      const all = tags.filter((x) => x.groupKey === gk && (!x.isHidden || sel.has(x.id)));
      const ranked = [...all].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.sort - b.sort);
      const top = expanded[gk] ? ranked : ranked.filter((x, i) => i < 6 || sel.has(x.id));
      return (
        <Sheet open onClose={close} title={title}>
          {dots}
          <h3>{t(`episode.journey.${gk}`)}</h3>
          <div className="bigchips">
            {top.map((x) => <button key={x.id} type="button" className={`chip ${sel.has(x.id) ? "on" : ""}`} onClick={() => toggleTag(x.id)}>{x.labelKey ? t(x.labelKey) : x.label}</button>)}
            {!expanded[gk] && ranked.length > top.length && <button type="button" className="chip other" onClick={() => setExpanded({ ...expanded, [gk]: true })}>{t("episode.more", { n: ranked.length - top.length })}</button>}
          </div>
          {expanded[gk] && <TagPicker groupKey={gk} tags={[]} selected={sel} onChange={onTags} onTagAdded={async () => setTags(await listTags())} compact />}
          {nav}
        </Sheet>
      );
    }
    return (
      <Sheet open onClose={close} title={title}>
        {dots}
        <h3>{t("episode.journey.note")}</h3>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => patch({ note: note.trim() || null })} placeholder={t("episode.notePh")} />
        {nav}
      </Sheet>
    );
  }

  // ---- full ---------------------------------------------------------------------------------------------------
  const lv = levelOf(ep.intensity);
  return (
    <Sheet open onClose={close} title={t("episode.title")} tall>
      <label className="field"><span>{t("episode.time")}</span>
        <input type="datetime-local" value={toLocalInput(ep.startedAt)} onChange={(e) => { if (!e.target.value) return; const at = fromLocalInput(e.target.value); void patch({ startedAt: at, endedAt: at }); }} />
      </label>
      <div className="field"><span>{t("episode.howStrong")}</span>
        <div className="bigchoice">
          {FLUSH_LEVELS.map((o) => <button key={o.k} type="button" className={`big ${o.k} ${lv === o.k ? "on" : ""}`} onClick={() => { haptics.tap(); void patch({ intensity: o.v }); }}>{t(`episode.level.${o.k}`)}</button>)}
        </div>
      </div>
      {groups.map((g) => (
        <TagPicker key={g.key} groupKey={g.key} tags={tags.filter((x) => x.groupKey === g.key)} selected={sel} onChange={onTags} onTagAdded={async () => setTags(await listTags())} />
      ))}
      <label className="field"><span>{t("episode.note")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => patch({ note: note.trim() || null })} placeholder={t("episode.notePh")} />
      </label>
      <div className="row between" style={{ marginTop: 18 }}>
        {confirmDelete
          ? <button type="button" className="ghost danger" onClick={onDelete}>{t("episode.deleteConfirm")}</button>
          : <button type="button" className="linklike" onClick={() => setConfirmDelete(true)}>{t("common.delete")}</button>}
        <button type="button" onClick={close}>{t("common.done")}</button>
      </div>
    </Sheet>
  );
}

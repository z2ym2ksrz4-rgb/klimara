import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listMedications, addMedication, updateMedication, type Medication } from "@/core/diary";
import { Sheet } from "@/core/ui";
import { useUi } from "../store";

/** The user's own preparations. No catalogue, no doses, no advice — just names and whether they are acute or preventive. */
export function MedicationsSheet() {
  const { t } = useTranslation();
  const open = useUi((s) => s.medsOpen);
  const setOpen = useUi((s) => s.setMedsOpen);
  const bump = useUi((s) => s.bump);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Medication["kind"]>("acute");
  const load = useCallback(async () => setMeds(await listMedications(true)), []);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const add = async () => { if (!name.trim()) return; await addMedication(name, kind); setName(""); await load(); bump(); };
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={t("meds.title")}>
      <p className="muted small">{t("meds.sub")}</p>
      <div className="row">
        <label className="field grow"><span>{t("meds.name")}</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("meds.namePh")} onKeyDown={(e) => e.key === "Enter" && add()} /></label>
      </div>
      <div className="segment" style={{ margin: "6px 0 10px" }}>
        <button className={kind === "acute" ? "active" : ""} onClick={() => setKind("acute")}>{t("meds.acute")}</button>
        <button className={kind === "preventive" ? "active" : ""} onClick={() => setKind("preventive")}>{t("meds.preventive")}</button>
      </div>
      <button className="cta" style={{ marginTop: 0 }} onClick={add} disabled={!name.trim()}>{t("common.add")}</button>
      <p className="muted small">{t("meds.acuteHint")}</p>
      <ul className="list">
        {meds.map((m) => (
          <li key={m.id} className="tap" style={{ opacity: m.isHidden ? 0.5 : 1 }}>
            <div><strong>{m.name}</strong><small>{t(`meds.${m.kind}`)}</small></div>
            <div className="row tight">
              <button className="small ghost" onClick={async () => { await updateMedication(m.id, { kind: m.kind === "acute" ? "preventive" : "acute" }); await load(); }}>⇄</button>
              <button className="small ghost" onClick={async () => { await updateMedication(m.id, { isHidden: m.isHidden ? 0 : 1 }); await load(); bump(); }}>{m.isHidden ? t("meds.show") : t("meds.hide")}</button>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

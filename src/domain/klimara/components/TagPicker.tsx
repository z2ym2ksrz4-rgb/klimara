import { useState } from "react";
import { useTranslation } from "react-i18next";
import { addUserTag, type Tag } from "@/core/diary";
import { haptics } from "@/core/ui";

/** One tag group as chips. "Other…" turns into an input; the typed text becomes a user tag in this group. */
export function TagPicker({ groupKey, tags, selected, onChange, onTagAdded, compact }: {
  groupKey: string; tags: Tag[]; selected: Set<string>; onChange: (next: Set<string>) => void; onTagAdded: () => void; compact?: boolean;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const toggle = (id: string) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); haptics.tap(); onChange(n); };
  const commit = async () => {
    const label = text.trim();
    setAdding(false); setText("");
    if (!label) return;
    const tag = await addUserTag(groupKey, label);
    const n = new Set(selected); n.add(tag.id); onChange(n); onTagAdded();
  };
  return (
    <div className={compact ? "chips" : "field"}>
      {!compact && <span>{t(`diary.groups.${groupKey}`)}</span>}
      <div className="chips">
        {tags.filter((x) => !x.isHidden || selected.has(x.id)).map((x) => (
          <button type="button" key={x.id} className={`chip ${selected.has(x.id) ? "on" : ""}`} onClick={() => toggle(x.id)}>
            {x.labelKey ? t(x.labelKey) : x.label}
          </button>
        ))}
        {adding ? (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("common.typeOwn")} style={{ maxWidth: 200 }}
            onKeyDown={(e) => { if (e.key === "Enter") void commit(); if (e.key === "Escape") { setAdding(false); setText(""); } }} onBlur={() => void commit()} />
        ) : (
          <button type="button" className="chip other" onClick={() => setAdding(true)}>+ {t("common.other")}</button>
        )}
      </div>
    </div>
  );
}

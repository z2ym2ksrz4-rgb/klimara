import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bottom sheet. Closes on backdrop tap or Escape. Rises above the on-screen keyboard (visualViewport) so the
 * field being typed in stays visible, and scrolls the focused field into view.
 */
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const vv = window.visualViewport;
    const onVV = () => {
      if (!ref.current || !vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      ref.current.style.setProperty("--kb", `${kb}px`);
      const el = document.activeElement as HTMLElement | null;
      if (kb > 0 && el && ref.current.contains(el)) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    };
    vv?.addEventListener("resize", onVV); vv?.addEventListener("scroll", onVV); onVV();
    const onFocus = (e: FocusEvent) => { const el = e.target as HTMLElement; if (ref.current?.contains(el)) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250); };
    document.addEventListener("focusin", onFocus);
    return () => { window.removeEventListener("keydown", h); vv?.removeEventListener("resize", onVV); vv?.removeEventListener("scroll", onVV); document.removeEventListener("focusin", onFocus); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`sheet ${tall ? "tall" : ""}`} ref={ref} onClick={(e) => e.stopPropagation()}>
        <button className="sheet-close" onClick={onClose} aria-label="close">×</button>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

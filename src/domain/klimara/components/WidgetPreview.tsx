import { useTranslation } from "react-i18next";
import { FlushMark } from "./FlushMark";

/** The little mock of the home-screen widget, shared by the onboarding intro and the settings guide. */
export function WidgetPreview() {
  const { t } = useTranslation();
  return (
    <div className="widget-preview">
      <div className="wp-tile"><FlushMark size={40} /><span>{t("widget.flushNow")}</span></div>
      <div className="wp-text"><strong>{t("widget.previewLine1")}</strong><span className="muted small">{t("widget.previewLine2")}</span></div>
    </div>
  );
}

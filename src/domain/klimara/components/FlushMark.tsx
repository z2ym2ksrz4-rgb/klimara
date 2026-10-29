/**
 * Klimara's mark: three rising heat waves over a crescent moon – a hot flush, by day and by night.
 * Used on the "Hot flush now" button, the widget preview and (as SVG) the app icon draft.
 */
export function FlushMark({ size = 32, wave = "#fff", moon = "rgba(255,255,255,.55)" }: { size?: number; wave?: string; moon?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M33 40a13 13 0 1 1-17-17a10 10 0 0 0 17 17z" fill={moon} />
      {[14, 23, 32].map((x, i) => (
        <path key={x} d={`M${x} ${30 - i * 2}c-3-4 3-6 0-10s3-6 0-10`} fill="none" stroke={wave} strokeWidth={3.2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

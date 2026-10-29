import appConfig from "../../../app.config.json";

/** PIN hash, salted with the app slug so a PIN hash from one app is useless in another. */
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${appConfig.appSlug}:${text}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

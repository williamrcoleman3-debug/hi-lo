// The on/off switch for the home page.
// Default: The Name Game. To bring Hi-Lo back, set VITE_HOME_GAME=hilo in
// Netlify (Site configuration -> Environment variables) and redeploy.
// Nothing about Hi-Lo is deleted while The Name Game is showing.
export function getHomeMode(env = import.meta.env) {
  const v = String(env?.VITE_HOME_GAME ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return v === "hilo" ? "hilo" : "namegame";
}

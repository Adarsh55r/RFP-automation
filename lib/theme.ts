/**
 * Light and dark theme. The choice ("light", "dark" or "system") is kept in
 * localStorage; THEME_SCRIPT runs in <head> before the page paints, so the
 * right theme shows from the first frame with no flash.
 */
export type ThemeChoice = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "draftbid-theme";

export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");var d=c==="dark"||((c===null||c==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

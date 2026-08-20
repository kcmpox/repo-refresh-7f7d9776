import { useEffect, useState, useCallback } from "react";

export type AppTheme = "padrao" | "dark";

const KEY = "gt_theme";

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove("theme-glass");
  html.classList.toggle("dark", theme === "dark");
}

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "padrao";
  const v = window.localStorage.getItem(KEY);
  return v === "dark" ? "dark" : "padrao";
}

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>("padrao");

  useEffect(() => {
    const t = getStoredTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  const update = useCallback((t: AppTheme) => {
    window.localStorage.setItem(KEY, t);
    applyTheme(t);
    setTheme(t);
  }, []);

  return [theme, update] as const;
}
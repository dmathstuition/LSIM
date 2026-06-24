"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "light", toggle: () => {}, setTheme: () => {},
});

export const useTheme = () => useContext(ThemeCtx);

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch {}
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from whatever the no-flash script (in layout) already set on <html>.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "light";
    setThemeState(current);
  }, []);

  const setTheme = (t: Theme) => { setThemeState(t); apply(t); };
  const toggle = () => setTheme(theme === "light" ? "dark" : "light");

  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>;
}

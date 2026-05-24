"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultTheme,
  themeStorageKey,
  type ThemeSettings,
} from "@/lib/theme/types";

type ThemeContextValue = {
  settings: ThemeSettings;
  update: (settings: Partial<ThemeSettings>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;
  root.dataset.themeMode = settings.mode;
  root.dataset.palette = settings.palette;
  root.dataset.density = settings.density;
  root.dataset.typeScale = settings.typeScale;
}

function readSavedTheme() {
  if (typeof window === "undefined") {
    return defaultTheme;
  }

  try {
    const saved = window.localStorage.getItem(themeStorageKey);
    return saved ? { ...defaultTheme, ...JSON.parse(saved) } : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(readSavedTheme);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      settings,
      update: (partial) => {
        setSettings((current) => {
          const next = { ...current, ...partial };
          applyTheme(next);
          window.localStorage.setItem(themeStorageKey, JSON.stringify(next));
          return next;
        });
      },
    }),
    [settings],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("ThemeProvider is missing");
  }

  return value;
}

export type ThemeMode = "light" | "dark";
export type ThemePalette = "star-map" | "matrix" | "deep-space" | "dawn-mist";
export type ThemeDensity = "comfortable" | "normal" | "compact";
export type ThemeTypeScale = "small" | "normal" | "large";

export type ThemeSettings = {
  mode: ThemeMode;
  palette: ThemePalette;
  density: ThemeDensity;
  typeScale: ThemeTypeScale;
};

export const themeStorageKey = "human-hunt-theme";

export const defaultTheme: ThemeSettings = {
  mode: "dark",
  palette: "star-map",
  density: "normal",
  typeScale: "normal",
};

export const palettes: ThemePalette[] = [
  "star-map",
  "matrix",
  "deep-space",
  "dawn-mist",
];

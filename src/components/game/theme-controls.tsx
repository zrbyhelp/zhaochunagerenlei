"use client";

import { useTranslations } from "next-intl";
import { Moon, Sun, Type, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeSettings } from "@/components/providers/theme-provider";
import { palettes, type ThemeDensity, type ThemeTypeScale } from "@/lib/theme/types";

export function ThemeControls() {
  const t = useTranslations("theme");
  const { settings, update } = useThemeSettings();
  const densities: ThemeDensity[] = ["comfortable", "normal", "compact"];
  const typeScales: ThemeTypeScale[] = ["small", "normal", "large"];

  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-[var(--muted-foreground)]">{t("mode")}</span>
        <Button
          type="button"
          size="sm"
          variant={settings.mode === "dark" ? "primary" : "secondary"}
          onClick={() => update({ mode: "dark" })}
          title={t("dark")}
        >
          <Moon size={16} />
          {t("dark")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={settings.mode === "light" ? "primary" : "secondary"}
          onClick={() => update({ mode: "light" })}
          title={t("light")}
        >
          <Sun size={16} />
          {t("light")}
        </Button>
      </div>
      <label className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-[var(--muted-foreground)]">{t("palette")}</span>
        <select
          className="h-9 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-[var(--foreground)]"
          value={settings.palette}
          onChange={(event) => update({ palette: event.target.value as typeof settings.palette })}
        >
          {palettes.map((palette) => (
            <option key={palette} value={palette}>
              {t(palette === "star-map" ? "starMap" : palette === "deep-space" ? "deepSpace" : palette === "dawn-mist" ? "dawnMist" : "matrix")}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-[var(--muted-foreground)]">{t("density")}</span>
        {densities.map((density) => (
          <Button
            key={density}
            type="button"
            size="sm"
            variant={settings.density === density ? "primary" : "secondary"}
            onClick={() => update({ density })}
            title={t(density)}
          >
            <Waves size={14} />
            {t(density)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-20 text-[var(--muted-foreground)]">{t("typeScale")}</span>
        {typeScales.map((typeScale) => (
          <Button
            key={typeScale}
            type="button"
            size="sm"
            variant={settings.typeScale === typeScale ? "primary" : "secondary"}
            onClick={() => update({ typeScale })}
            title={t(typeScale)}
          >
            <Type size={14} />
            {t(typeScale)}
          </Button>
        ))}
      </div>
    </div>
  );
}

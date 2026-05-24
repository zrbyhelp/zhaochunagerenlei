"use client";

import { ArrowLeft, FileText, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeControls } from "@/components/game/theme-controls";
import { Link } from "@/i18n/routing";

export function AdminShell() {
  const t = useTranslations("admin");

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[1fr_1fr]">
      <section className="panel p-5 lg:col-span-2">
        <Link
          className="mb-5 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
          href="/"
        >
          <ArrowLeft size={16} />
          {t("backToGame")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
          {t("subtitle")}
        </p>
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <SlidersHorizontal className="text-[var(--accent)]" size={20} />
          <h2 className="text-sm font-semibold uppercase text-[var(--accent)]">
            {t("themeSettings")}
          </h2>
        </div>
        <ThemeControls />
      </section>

      <section className="panel p-5">
        <div className="mb-3 flex items-center gap-3">
          <FileText className="text-[var(--accent)]" size={20} />
          <h2 className="text-sm font-semibold uppercase text-[var(--accent)]">
            {t("projectInfo")}
          </h2>
        </div>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t("projectDescription")}
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {t("license")}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {t("contact")}
        </p>
      </section>
    </main>
  );
}

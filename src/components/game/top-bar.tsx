"use client";

import { Languages, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter, type AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const t = useTranslations("nav");
  const meta = useTranslations("meta");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link
        href="/"
        className="max-w-[52vw] truncate text-sm font-semibold text-[var(--accent)]"
      >
        {meta("title")}
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/admin">
          <Button type="button" variant="secondary" size="sm" title={t("admin")}>
            <Settings size={16} />
            {t("admin")}
          </Button>
        </Link>
        <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-xs font-semibold">
          <Languages size={14} />
          <span className="sr-only">{t("language")}</span>
          <select
            className="bg-transparent text-[var(--foreground)] outline-none"
            value={locale}
            onChange={(event) =>
              router.replace(pathname, { locale: event.target.value as AppLocale })
            }
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
      </nav>
    </header>
  );
}

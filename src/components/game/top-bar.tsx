"use client";

import { Languages, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Link, type AppLocale, routing } from "@/i18n/routing";

const githubUrl = "https://github.com/zrbyhelp/zhaochunagerenlei";

export function TopBar() {
  const t = useTranslations("nav");
  const meta = useTranslations("meta");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [languageOpen, setLanguageOpen] = useState(false);

  function switchLocale(nextLocale: AppLocale) {
    const segments = pathname.split("/");
    const hasLocalePrefix = routing.locales.includes(segments[1] as AppLocale);

    if (hasLocalePrefix) {
      segments[1] = nextLocale;
    } else {
      segments.splice(1, 0, nextLocale);
    }

    const nextPath = segments.join("/") || `/${nextLocale}`;
    setLanguageOpen(false);
    router.replace(`${nextPath}${window.location.search}${window.location.hash}`);
  }

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
      <Link
        href="/"
        className="max-w-[58vw] truncate text-sm font-semibold text-[var(--accent)]"
      >
        {meta("title")}
      </Link>
      <nav className="flex items-center gap-2">
        <a
          aria-label={t("github")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
          href={githubUrl}
          rel="noreferrer"
          target="_blank"
          title={t("github")}
        >
          <GitHubMark />
        </a>
        <Link
          aria-label={t("admin")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
          href="/admin"
          title={t("admin")}
        >
          <Settings size={16} />
        </Link>
        <div className="relative">
          <button
            aria-expanded={languageOpen}
            aria-label={t("language")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)] transition hover:bg-[var(--panel-strong)]"
            onClick={() => setLanguageOpen((open) => !open)}
            title={t("language")}
            type="button"
          >
            <Languages size={14} />
          </button>
          {languageOpen ? (
            <div className="absolute right-0 z-20 mt-2 grid min-w-28 gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-1 text-sm shadow-lg shadow-black/15">
              {routing.locales.map((item) => (
                <button
                  className={`rounded-md px-3 py-2 text-left transition ${
                    locale === item
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "text-[var(--foreground)] hover:bg-[var(--panel)]"
                  }`}
                  key={item}
                  onClick={() => switchLocale(item)}
                  type="button"
                >
                  {item === "zh-CN" ? "中文" : "English"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.4 7.9 10.9.58.1.8-.25.8-.56v-2.03c-3.22.7-3.9-1.38-3.9-1.38-.53-1.34-1.3-1.7-1.3-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.79 1.2 1.79 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.3-5.27-1.29-5.27-5.72 0-1.26.45-2.3 1.2-3.1-.12-.3-.52-1.49.11-3.08 0 0 .98-.31 3.2 1.18A11.1 11.1 0 0 1 12 6.03c.96 0 1.92.13 2.82.38 2.22-1.5 3.2-1.18 3.2-1.18.63 1.6.23 2.78.11 3.08.75.8 1.2 1.84 1.2 3.1 0 4.45-2.7 5.42-5.28 5.7.42.37.79 1.08.79 2.17v3.05c0 .31.2.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

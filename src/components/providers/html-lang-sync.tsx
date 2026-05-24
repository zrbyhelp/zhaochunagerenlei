"use client";

import { useEffect } from "react";
import type { AppLocale } from "@/i18n/routing";

export function HtmlLangSync({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

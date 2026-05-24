"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, KeyRound, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeControls } from "@/components/game/theme-controls";

type ModelStatus = {
  configured: boolean;
  apiKey: boolean;
  model: string | null;
  baseUrl: string | null;
  langfuse: boolean;
  missing: string[];
};

export function AdminShell() {
  const t = useTranslations("admin");
  const [status, setStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((response) => response.json())
      .then((data: ModelStatus) => setStatus(data))
      .catch(() =>
        setStatus({
          configured: false,
          apiKey: false,
          model: null,
          baseUrl: null,
          langfuse: false,
          missing: ["OPENAI_API_KEY", "OPENAI_MODEL"],
        }),
      );
  }, []);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[1fr_1fr]">
      <section className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <KeyRound className="text-[var(--accent)]" size={22} />
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--accent)]">
          {t("modelStatus")}
        </h2>
        <div className="grid gap-3">
          <StatusRow
            label={t("apiKey")}
            ok={Boolean(status?.apiKey)}
            value={status?.apiKey ? t("configured") : t("missing")}
          />
          <StatusRow
            label={t("model")}
            ok={Boolean(status?.model)}
            value={status?.model ?? t("missing")}
          />
          <StatusRow
            label={t("baseUrl")}
            ok={Boolean(status?.baseUrl)}
            value={status?.baseUrl ?? t("defaultBaseUrl")}
          />
          <StatusRow
            label={t("langfuse")}
            ok={Boolean(status?.langfuse)}
            value={status?.langfuse ? t("configured") : t("missing")}
          />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase text-[var(--accent)]">
          {t("themeSettings")}
        </h2>
        <ThemeControls />
      </section>

      <section className="panel p-5 lg:col-span-2">
        <div className="mb-3 flex items-center gap-3">
          <FileText className="text-[var(--accent)]" size={20} />
          <h2 className="text-sm font-semibold uppercase text-[var(--accent)]">
            {t("projectInfo")}
          </h2>
        </div>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {t("license")}
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {t("contact")}
        </p>
      </section>
    </main>
  );
}

function StatusRow({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
        {ok ? (
          <CheckCircle2 className="shrink-0 text-[var(--accent)]" size={16} />
        ) : (
          <XCircle className="shrink-0 text-[var(--danger)]" size={16} />
        )}
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type ModelEnv =
  | {
      ok: true;
      value: {
        OPENAI_API_KEY: string;
        OPENAI_MODEL: string;
        OPENAI_BASE_URL?: string;
        LANGFUSE_PUBLIC_KEY?: string;
        LANGFUSE_SECRET_KEY?: string;
        LANGFUSE_BASEURL?: string;
      };
    }
  | {
      ok: false;
      error: string;
      missing: string[];
    };

export function readModelEnv(): ModelEnv {
  const missingRequired = ["OPENAI_API_KEY", "OPENAI_MODEL"].filter(
    (key) => !process.env[key],
  );

  if (missingRequired.length > 0) {
    return {
      ok: false,
      error: "MODEL_ENV_INVALID",
      missing: missingRequired,
    };
  }

  try {
    const env = createEnv({
      server: {
        OPENAI_API_KEY: z.string().min(1),
        OPENAI_MODEL: z.string().min(1),
        OPENAI_BASE_URL: z.string().url().optional(),
        LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
        LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
        LANGFUSE_BASEURL: z.string().url().optional(),
      },
      runtimeEnv: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
        LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
        LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
        LANGFUSE_BASEURL: process.env.LANGFUSE_BASEURL,
      },
      emptyStringAsUndefined: true,
    });

    return {
      ok: true,
      value: env,
    };
  } catch {
    return {
      ok: false,
      error: "MODEL_ENV_INVALID",
      missing: missingRequired,
    };
  }
}

export function modelStatus() {
  const env = readModelEnv();

  return {
    configured: env.ok,
    apiKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? null,
    baseUrl: process.env.OPENAI_BASE_URL ?? null,
    langfuse: Boolean(
      process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
    ),
    missing: env.ok ? [] : env.missing,
  };
}

import { afterEach, describe, expect, it } from "vitest";
import { readModelEnv } from "@/lib/ai/env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("model env", () => {
  it("reports missing required model variables", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;

    const env = readModelEnv();

    expect(env.ok).toBe(false);
    if (!env.ok) {
      expect(env.missing).toContain("OPENAI_API_KEY");
      expect(env.missing).toContain("OPENAI_MODEL");
    }
  });

  it("accepts OpenAI-compatible configuration", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_BASE_URL = "https://example.com/v1";

    const env = readModelEnv();

    expect(env.ok).toBe(true);
  });
});

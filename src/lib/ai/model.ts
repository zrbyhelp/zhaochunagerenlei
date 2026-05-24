import { observeOpenAI } from "langfuse";
import OpenAI from "openai";
import { readModelEnv } from "./env";
import {
  AiActionRequestSchema,
  WordPairSchema,
  parseModelJson,
  responseSchemaForAction,
  type AiActionRequest,
  type AiActionResponse,
  type WordPairOutput,
} from "./schemas";
import { actionPrompt, wordPairPrompt } from "./prompts";
import type { Locale } from "../game/types";

type FlushableOpenAI = OpenAI & {
  flushAsync?: () => Promise<void>;
};

const maxModelAttempts = 3;

function createClient(traceName: string): { client: FlushableOpenAI; model: string } {
  const env = readModelEnv();

  if (!env.ok) {
    throw new Error(env.error);
  }

  const baseClient = new OpenAI({
    apiKey: env.value.OPENAI_API_KEY,
    baseURL: env.value.OPENAI_BASE_URL,
  });

  const hasLangfuse =
    env.value.LANGFUSE_PUBLIC_KEY && env.value.LANGFUSE_SECRET_KEY;
  const client = hasLangfuse
    ? (observeOpenAI(baseClient, {
        traceName,
        metadata: { app: "sheishiwodi-zhaochunagerenlei" },
        clientInitParams: {
          publicKey: env.value.LANGFUSE_PUBLIC_KEY,
          secretKey: env.value.LANGFUSE_SECRET_KEY,
          baseUrl: env.value.LANGFUSE_BASEURL,
        },
      }) as FlushableOpenAI)
    : baseClient;

  return { client, model: env.value.OPENAI_MODEL };
}

async function completeJson(
  traceName: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: { temperature?: number; topP?: number } = {},
) {
  const { client, model } = createClient(traceName);
  const completion = await client.chat.completions.create({
    model,
    temperature: options.temperature ?? 0.72,
    top_p: options.topP,
    messages,
    response_format: { type: "json_object" },
  });
  await client.flushAsync?.();

  return completion.choices[0]?.message.content ?? "";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryModelError(error: unknown) {
  return !(error instanceof Error && error.message === "MODEL_ENV_INVALID");
}

async function withModelRetry<T>(operation: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxModelAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxModelAttempts || !shouldRetryModelError(error)) {
        break;
      }

      await wait(180 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("MODEL_RETRY_FAILED");
}

export async function generateWordPair(
  locale: Locale,
  options: Parameters<typeof wordPairPrompt>[1] = {},
): Promise<WordPairOutput> {
  const prompt = wordPairPrompt(locale, options);

  return withModelRetry(async (attempt) => {
    const content = await completeJson(`game.word_pair.attempt_${attempt}`, [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ], { temperature: 0.98, topP: 0.95 });

    return parseModelJson(content, WordPairSchema);
  });
}

export async function runAiAction(input: unknown) {
  const request = AiActionRequestSchema.parse(input);
  const prompt = actionPrompt(request);

  return withModelRetry(async (attempt) => {
    const content = await completeJson(`game.${request.action}.attempt_${attempt}`, [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ]);
    const output = parseModelJson(content, responseSchemaForAction(request.action));
    validateTarget(request, output);

    return output;
  });
}

function validateTarget(
  request: AiActionRequest,
  output: AiActionResponse,
) {
  if (!("targetId" in output) && !("suspicionTargetId" in output)) {
    return;
  }

  const targetId =
    "targetId" in output ? output.targetId : output.suspicionTargetId;
  if (!targetId) {
    throw new Error("MODEL_TARGET_MISSING");
  }
  const validIds = new Set(request.candidates.map((candidate) => candidate.id));

  if (!validIds.has(targetId)) {
    throw new Error("MODEL_TARGET_OUT_OF_RANGE");
  }
}

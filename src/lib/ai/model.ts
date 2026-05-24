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

export async function generateWordPair(
  locale: Locale,
  options: Parameters<typeof wordPairPrompt>[1] = {},
): Promise<WordPairOutput> {
  const prompt = wordPairPrompt(locale, options);
  const content = await completeJson("game.word_pair", [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ], { temperature: 0.98, topP: 0.95 });

  return parseModelJson(content, WordPairSchema);
}

export async function runAiAction(input: unknown) {
  const request = AiActionRequestSchema.parse(input);
  const prompt = actionPrompt(request);
  const content = await completeJson(`game.${request.action}`, [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ]);
  const output = parseModelJson(content, responseSchemaForAction(request.action));
  validateTarget(request, output);

  return output;
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

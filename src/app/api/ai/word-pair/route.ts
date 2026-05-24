import { NextResponse } from "next/server";
import { z } from "zod";
import { readModelEnv } from "@/lib/ai/env";
import { generateWordPair } from "@/lib/ai/model";
import type { Locale, WordPair } from "@/lib/game/types";

const RequestSchema = z.object({
  locale: z.enum(["zh-CN", "en-US"]),
});

const recentWordPairs: string[] = [];
const maxRecentPairs = 24;

const categories: Record<Locale, string[]> = {
  "zh-CN": [
    "生活物品",
    "食物饮品",
    "办公用品",
    "学习用品",
    "交通工具",
    "常见职业",
    "日常地点",
    "影视动漫人物",
    "游戏角色",
    "常见家电",
    "运动娱乐",
    "服饰配件",
  ],
  "en-US": [
    "household items",
    "food and drinks",
    "office supplies",
    "school supplies",
    "transport",
    "common jobs",
    "everyday places",
    "movie and anime characters",
    "game characters",
    "home appliances",
    "sports and hobbies",
    "clothing and accessories",
  ],
};

function pickCategory(locale: Locale) {
  const pool = categories[locale];
  return pool[Math.floor(Math.random() * pool.length)];
}

function wordPairKey(wordPair: Pick<WordPair, "commonWord" | "undercoverWord">) {
  return [wordPair.commonWord, wordPair.undercoverWord]
    .map((word) => word.trim().toLocaleLowerCase())
    .sort()
    .join(" / ");
}

function rememberWordPair(wordPair: WordPair) {
  const key = wordPairKey(wordPair);
  recentWordPairs.unshift(key);
  recentWordPairs.splice(maxRecentPairs);
}

export async function POST(request: Request) {
  const env = readModelEnv();

  if (!env.ok) {
    return NextResponse.json(
      { error: env.error, missing: env.missing },
      { status: 503 },
    );
  }

  try {
    const body = RequestSchema.parse(await request.json());
    let wordPair: WordPair | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = await generateWordPair(body.locale, {
        category: pickCategory(body.locale),
        seed: `${Date.now()}-${crypto.randomUUID()}-${attempt}`,
        avoidPairs: recentWordPairs,
      });

      wordPair = candidate;

      if (!recentWordPairs.includes(wordPairKey(candidate))) {
        break;
      }
    }

    if (!wordPair) {
      throw new Error("WORD_PAIR_EMPTY");
    }

    rememberWordPair(wordPair);

    return NextResponse.json({ wordPair });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { describe, expect, it } from "vitest";
import {
  Phase1SpeechSchema,
  Phase1VoteSchema,
  Phase2DefenseSchema,
  Phase2VoteSchema,
  VoteActionSchema,
  WordPairSchema,
  parseModelJson,
} from "@/lib/ai/schemas";

describe("AI schemas", () => {
  it("parses fenced model JSON", () => {
    const result = parseModelJson(
      '```json\n{"targetId":"ai-1","reason":"发言与其他人明显不同"}\n```',
      VoteActionSchema,
    );

    expect(result.targetId).toBe("ai-1");
  });

  it("rejects invalid model JSON", () => {
    expect(() => parseModelJson("no json here", VoteActionSchema)).toThrow(
      "MODEL_JSON_NOT_FOUND",
    );
  });

  it("keeps phase-one vote targets while tolerating extra model fields", () => {
    expect(Phase1VoteSchema.parse({ targetId: "ai-1" })).toEqual({
      targetId: "ai-1",
    });

    expect(
      Phase1VoteSchema.parse({
        targetId: "ai-1",
        reason: "我觉得他描述不太一样",
      }),
    ).toEqual({ targetId: "ai-1" });
  });

  it("requires phase-two votes to include a reason", () => {
    expect(() => Phase2VoteSchema.parse({ targetId: "ai-1" })).toThrow();
    expect(
      Phase2VoteSchema.parse({
        targetId: "ai-1",
        reason: "他二阶段解释和一阶段行为对不上。",
      }),
    ).toMatchObject({ targetId: "ai-1" });
  });

  it("defaults optional phase-two defense support fields", () => {
    expect(
      Phase2DefenseSchema.parse({
        claim: "我不是人类，我当时就是按自己的词在说。",
        suspicionTargetId: "player",
      }),
    ).toMatchObject({
      suspicionReason: "",
      contextAnchors: [],
    });
  });

  it("does not cap verbose but valid model output", () => {
    const longText = "这个描述我会说得稍微长一点，但仍然是模型返回的有效文本。".repeat(12);
    const anchors = Array.from({ length: 8 }, (_, index) => `一阶段上下文 ${index + 1}`);

    expect(Phase1SpeechSchema.parse({ speech: longText }).speech).toBe(longText);
    expect(
      WordPairSchema.parse({
        commonWord: "咖啡",
        undercoverWord: "奶茶",
        category: "食物饮品".repeat(6),
        sceneIntro: longText,
      }).sceneIntro,
    ).toBe(longText);
    expect(
      Phase2DefenseSchema.parse({
        claim: longText,
        suspicionTargetId: "player",
        suspicionReason: longText,
        contextAnchors: anchors,
      }).contextAnchors,
    ).toHaveLength(8);
  });
});

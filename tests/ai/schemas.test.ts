import { describe, expect, it } from "vitest";
import {
  Phase1VoteSchema,
  Phase2DefenseSchema,
  Phase2VoteSchema,
  VoteActionSchema,
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

  it("keeps phase-one votes to target only", () => {
    expect(Phase1VoteSchema.parse({ targetId: "ai-1" })).toEqual({
      targetId: "ai-1",
    });

    expect(() =>
      Phase1VoteSchema.parse({
        targetId: "ai-1",
        reason: "我觉得他描述不太一样",
      }),
    ).toThrow();
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

  it("requires phase-two defenses to include context anchors", () => {
    expect(() =>
      Phase2DefenseSchema.parse({
        claim: "我不是人类，我的行为符合 AI 审查协议。",
        suspicionTargetId: "player",
        suspicionReason: "他在一阶段投票时没有解释清楚。",
        contextAnchors: [],
      }),
    ).toThrow();
  });
});

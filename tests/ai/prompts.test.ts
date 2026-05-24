import { describe, expect, it } from "vitest";
import { actionPrompt, wordPairPrompt } from "@/lib/ai/prompts";

describe("AI prompts", () => {
  it("constrains word pairs to common close game words", () => {
    const prompt = wordPairPrompt("zh-CN", {
      category: "食物饮品",
      seed: "test-seed-42",
      avoidPairs: ["牙刷 / 牙膏"],
    });
    const joined = `${prompt.system}\n${prompt.user}`;

    expect(joined).toContain("household items");
    expect(joined).toContain("toothbrush/toothpaste");
    expect(joined).toContain("Do not copy them");
    expect(joined).toContain("Do not generate abstract concepts");
    expect(joined).toContain("same broad category");
    expect(joined).toContain("test-seed-42");
    expect(joined).toContain("Required category for this round: 食物饮品");
    expect(joined).toContain("牙刷 / 牙膏");
    expect(joined).toContain("Do not generate these pairs");
  });

  it("passes persona into action prompts for human-like speech", () => {
    const prompt = actionPrompt({
      action: "phase1Speech",
      locale: "zh-CN",
      actor: {
        id: "ai-1",
        name: "林澈",
        word: "牙刷",
        persona: {
          label: "轻松吐槽型",
          speakingStyle: "话比较短，像朋友桌游局随口说。",
          catchphrases: ["说实话"],
          reasoningStyle: "更多从直觉和日常体验切入。",
        },
      },
      candidates: [{ id: "player", name: "玩家" }],
      context: {},
    });

    expect(prompt.system).toContain("轻松吐槽型");
    expect(prompt.system).toContain("Speak naturally");
    expect(prompt.user).toContain("real player");
    expect(prompt.user).toContain("worried you might be the undercover");
    expect(prompt.user).toContain("Give only one low-risk clue");
    expect(prompt.user).toContain("Avoid highly specific uses");
  });

  it("tells phase-one AI players to reason cautiously without knowing identity", () => {
    const prompt = actionPrompt({
      action: "phase1Vote",
      locale: "zh-CN",
      actor: {
        id: "ai-1",
        name: "周予安",
        word: "键盘",
      },
      candidates: [{ id: "player", name: "玩家" }],
      context: {},
    });
    const joined = `${prompt.system}\n${prompt.user}`;

    expect(joined).toContain("You only know your own word");
    expect(joined).toContain("do not know whether you are ordinary or undercover");
    expect(joined).toContain("Infer the likely real majority word");
    expect(joined).toContain("you may have the different word");
    expect(joined).toContain("Only return targetId");
    expect(joined).not.toContain("\"reason\":\"string\"");
  });

  it("asks phase-two defenses to use public phase-one context without hidden answers", () => {
    const prompt = actionPrompt({
      action: "phase2Defense",
      locale: "zh-CN",
      actor: {
        id: "ai-2",
        name: "陈青禾",
        word: "鼠标",
      },
      candidates: [{ id: "player", name: "玩家" }],
      context: { speeches: [], phase1Votes: [], eliminations: [] },
    });
    const joined = `${prompt.system}\n${prompt.user}`;

    expect(joined).toContain("true word pair");
    expect(joined).toContain("what you thought others were probably describing");
    expect(joined).toContain("why your own speech or vote made sense");
    expect(joined).toContain("ownWord");
  });
});

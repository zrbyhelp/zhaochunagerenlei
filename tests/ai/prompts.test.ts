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
          votingBias: "跟风偏差：容易受已经出现的票影响。",
        },
      },
      candidates: [{ id: "player", name: "玩家" }],
      context: {},
    });

    expect(prompt.system).toContain("轻松吐槽型");
    expect(prompt.system).toContain("Voting bias");
    expect(prompt.system).toContain("跟风偏差");
    expect(prompt.system).toContain("Speak naturally");
    expect(prompt.system).toContain("AI participant");
    expect(prompt.system).toContain("hidden human");
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
    expect(joined).toContain("not a perfect detective");
    expect(joined).toContain("Do not optimize for the single best semantic outlier");
    expect(joined).toContain("Use your voting bias");
    expect(joined).toContain("currentVotes");
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
    expect(joined).toContain("AI screening hearing");
    expect(joined).toContain("not the hidden human");
    expect(joined).toContain("not mainly about solving the undercover word");
    expect(joined).toContain("human disguise");
    expect(joined).toContain("what you thought others were describing in phase one");
    expect(joined).toContain("your AI-like behavior");
    expect(joined).toContain("ownWord");
  });

  it("keeps phase-two votes focused on finding the hidden human", () => {
    const prompt = actionPrompt({
      action: "phase2Vote",
      locale: "zh-CN",
      actor: {
        id: "ai-3",
        name: "沈砚",
        word: "订书机",
      },
      candidates: [{ id: "player", name: "玩家" }],
      context: { phaseOne: {}, phaseTwoStatements: [] },
    });
    const joined = `${prompt.system}\n${prompt.user}`;

    expect(joined).toContain("hidden human pretending to be AI");
    expect(joined).toContain("human-screening vote");
    expect(joined).toContain("behavioral evidence only");
    expect(joined).toContain("Do not make the vote reason mainly about who had the wrong word");
  });
});

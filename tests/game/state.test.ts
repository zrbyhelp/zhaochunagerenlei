import { describe, expect, it } from "vitest";
import {
  PLAYER_ID,
  buildPhase2Context,
  createGame,
  getCurrentSpeaker,
  recordPhase1Votes,
  recordPhase2Statement,
  recordPhase2Votes,
  recordSpeech,
} from "@/lib/game/state";
import type { WordPair } from "@/lib/game/types";

const wordPair: WordPair = {
  commonWord: "月亮",
  undercoverWord: "太阳",
  category: "天体",
  sceneIntro: "一组用于测试的词语。",
};

function rng(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.1;
}

describe("game state", () => {
  it("creates a 4-10 player game with user name and random AI names", () => {
    const state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.2, 0.4, 0.6, 0.8]),
    });

    expect(state.participants).toHaveLength(4);
    expect(state.participants[0]).toMatchObject({
      id: PLAYER_ID,
      name: "测试员",
      kind: "human",
    });
    expect(state.participants.slice(1).every((item) => item.kind === "ai")).toBe(true);
    expect(state.participants.slice(1).every((item) => item.persona)).toBe(true);
    expect(state.participants.slice(1).map((item) => item.name)).not.toContain("星图零一");
    expect(state.speakingOrder).toHaveLength(4);
  });

  it("rejects out-of-range player counts", () => {
    expect(() =>
      createGame({
        locale: "zh-CN",
        playerName: "测试员",
        playerCount: 3,
        wordPair,
      }),
    ).toThrow("PLAYER_COUNT_OUT_OF_RANGE");
  });

  it("moves from speeches to phase-one vote", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });

    for (const speakerId of state.speakingOrder) {
      state = recordSpeech(state, speakerId, `${speakerId} says clue`);
    }

    expect(state.stage).toBe("phase1_vote");
    expect(state.speeches).toHaveLength(4);
  });

  it("sends the player to phase two when phase one is won", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });
    const undercoverId = state.undercoverId;

    for (const speakerId of state.speakingOrder) {
      state = recordSpeech(state, speakerId, `${speakerId} says clue`);
    }

    state = recordPhase1Votes(
      state,
      state.participants.map((participant) => ({
        voterId: participant.id,
        targetId: undercoverId,
        reason: "looks different",
      })),
    );

    expect(state.stage).toBe("phase2_defense");
  });

  it("builds phase-two context without exposing hidden words or roles", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });

    for (const speakerId of state.speakingOrder) {
      state = recordSpeech(state, speakerId, `${speakerId} says clue`);
    }

    const context = buildPhase2Context(state);

    expect(context).not.toHaveProperty("wordPair");
    expect(JSON.stringify(context)).not.toContain(wordPair.commonWord);
    expect(JSON.stringify(context)).not.toContain(wordPair.undercoverWord);
    expect(context.participants[0]).not.toHaveProperty("role");
    expect(context.participants[0]).not.toHaveProperty("word");
    expect(context.participants[0]).not.toHaveProperty("kind");
  });

  it("fails phase one when the player is eliminated", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.5, 0.1, 0.2, 0.3, 0.4]),
    });

    for (const speakerId of state.speakingOrder) {
      state = recordSpeech(state, speakerId, `${speakerId} says clue`);
    }

    state = recordPhase1Votes(
      state,
      state.participants.map((participant) => ({
        voterId: participant.id,
        targetId: PLAYER_ID,
        reason: "too human",
      })),
    );

    expect(state.stage).toBe("final");
    expect(state.result?.outcome).toBe("phase1_player_lost");
  });

  it("fails phase two when the player is top-voted", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });
    const undercoverId = state.undercoverId;

    for (const speakerId of state.speakingOrder) {
      state = recordSpeech(state, speakerId, `${speakerId} says clue`);
    }
    state = recordPhase1Votes(
      state,
      state.participants.map((participant) => ({
        voterId: participant.id,
        targetId: undercoverId,
        reason: "looks different",
      })),
    );

    while (state.stage === "phase2_defense") {
      const speaker = getCurrentSpeaker(state);
      if (!speaker) throw new Error("missing speaker");
      const target = state.participants.find(
        (participant) => participant.active && participant.id !== speaker.id,
      );
      if (!target) throw new Error("missing target");
      state = recordPhase2Statement(state, {
        speakerId: speaker.id,
        claim: `${speaker.name} is not human`,
        suspicionTargetId: target.id,
        suspicionReason: "phase one behavior was suspicious",
        contextAnchors: ["phase-one vote"],
      });
    }

    state = recordPhase2Votes(
      state,
      state.participants
        .filter((participant) => participant.active)
        .map((participant) => ({
          voterId: participant.id,
          targetId: PLAYER_ID,
          reason: "human trace detected",
        })),
    );

    expect(state.result?.outcome).toBe("phase2_player_lost");
  });
});

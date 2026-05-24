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
import type { GameState, WordPair } from "@/lib/game/types";

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

function recordSpeechRound(state: GameState) {
  let next = state;
  for (const speakerId of next.speakingOrder) {
    next = recordSpeech(next, speakerId, `${speakerId} says clue`);
  }
  return next;
}

function voteAllFor(state: GameState, targetId: string) {
  return state.participants
    .filter((participant) => participant.active)
    .map((participant) => ({
      voterId: participant.id,
      targetId,
      reason: "test vote",
    }));
}

function recordPhase2DefenseRound(state: GameState) {
  let next = state;
  while (next.stage === "phase2_defense") {
    const speaker = getCurrentSpeaker(next);
    if (!speaker) throw new Error("missing speaker");
    const target = next.participants.find(
      (participant) => participant.active && participant.id !== speaker.id,
    );
    if (!target) throw new Error("missing target");
    next = recordPhase2Statement(next, {
      speakerId: speaker.id,
      claim: `${speaker.name} is not human`,
      suspicionTargetId: target.id,
      suspicionReason: "phase one behavior was suspicious",
      contextAnchors: ["phase-one vote"],
    });
  }
  return next;
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
    expect(state.participants.slice(1).every((item) => item.persona?.votingBias)).toBe(true);
    expect(state.participants.slice(1).map((item) => item.name)).not.toContain("星图零一");
    expect(state.speakingOrder).toHaveLength(4);
    expect(state.phase2Round).toBe(1);
    expect(state.tieRecords).toEqual([]);
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
    expect(state.phase2Round).toBe(1);
  });

  it("restarts phase one without elimination when votes are tied", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });
    state = recordSpeechRound(state);
    const [, ai1, ai2, ai3] = state.participants;

    state = recordPhase1Votes(state, [
      { voterId: PLAYER_ID, targetId: ai1.id, reason: "tie" },
      { voterId: ai1.id, targetId: PLAYER_ID, reason: "tie" },
      { voterId: ai2.id, targetId: PLAYER_ID, reason: "tie" },
      { voterId: ai3.id, targetId: ai1.id, reason: "tie" },
    ]);

    expect(state.stage).toBe("phase1_speech");
    expect(state.phase1Round).toBe(2);
    expect(state.eliminations).toHaveLength(0);
    expect(state.tieRecords).toMatchObject([
      { phase: "phase1", round: 1, tiedIds: expect.arrayContaining([PLAYER_ID, ai1.id]) },
    ]);
  });

  it("sends undercover player to phase two when only two remain in phase one", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0, 0.1, 0.2, 0.3, 0.4]),
    });
    const [, ai1, ai2] = state.participants;

    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, ai1.id));
    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, ai2.id));

    expect(state.participants.filter((participant) => participant.active)).toHaveLength(2);
    expect(state.stage).toBe("phase2_defense");
    expect(state.participants.find((participant) => participant.id === PLAYER_ID)?.role).toBe(
      "undercover",
    );
  });

  it("fails civilian player when only two remain with the undercover in phase one", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });
    const undercoverId = state.undercoverId;
    const targets = state.participants.filter(
      (participant) => participant.id !== PLAYER_ID && participant.id !== undercoverId,
    );

    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, targets[0].id));
    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, targets[1].id));

    expect(state.participants.filter((participant) => participant.active)).toHaveLength(2);
    expect(state.stage).toBe("final");
    expect(state.result?.outcome).toBe("phase1_player_lost");
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

    state = recordPhase2DefenseRound(state);

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

  it("restarts phase two without elimination when votes are tied", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 5,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4, 0.5]),
    });
    const undercoverId = state.undercoverId;

    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, undercoverId));
    state = recordPhase2DefenseRound(state);

    const active = state.participants.filter((participant) => participant.active);
    const aiTargets = active.filter((participant) => participant.id !== PLAYER_ID);
    state = recordPhase2Votes(state, [
      { voterId: PLAYER_ID, targetId: aiTargets[0].id, reason: "tie" },
      { voterId: aiTargets[0].id, targetId: PLAYER_ID, reason: "tie" },
      { voterId: aiTargets[1].id, targetId: PLAYER_ID, reason: "tie" },
      { voterId: aiTargets[2].id, targetId: aiTargets[0].id, reason: "tie" },
    ]);

    expect(state.stage).toBe("phase2_defense");
    expect(state.phase2Round).toBe(2);
    expect(state.eliminations.filter((record) => record.phase === "phase2")).toHaveLength(0);
    expect(state.tieRecords).toMatchObject([
      expect.objectContaining({ phase: "phase2", round: 1 }),
    ]);

    const speaker = getCurrentSpeaker(state);
    if (!speaker) throw new Error("missing speaker");
    const target = state.participants.find(
      (participant) => participant.active && participant.id !== speaker.id,
    );
    if (!target) throw new Error("missing target");
    state = recordPhase2Statement(state, {
      speakerId: speaker.id,
      claim: `${speaker.name} is still not human`,
      suspicionTargetId: target.id,
      suspicionReason: "new round after tie",
      contextAnchors: ["phase-two tie"],
    });

    expect(state.phase2Statements.at(-1)?.round).toBe(2);
  });

  it("wins phase two when the player survives into the final two", () => {
    let state = createGame({
      locale: "zh-CN",
      playerName: "测试员",
      playerCount: 4,
      wordPair,
      rng: rng([0.99, 0.1, 0.2, 0.3, 0.4]),
    });
    const undercoverId = state.undercoverId;

    state = recordSpeechRound(state);
    state = recordPhase1Votes(state, voteAllFor(state, undercoverId));
    state = recordPhase2DefenseRound(state);

    const target = state.participants.find(
      (participant) => participant.active && participant.id !== PLAYER_ID,
    );
    if (!target) throw new Error("missing target");
    state = recordPhase2Votes(state, voteAllFor(state, target.id));

    expect(state.stage).toBe("final");
    expect(state.result?.outcome).toBe("phase2_player_won");
    expect(state.participants.filter((participant) => participant.active)).toHaveLength(2);
  });
});

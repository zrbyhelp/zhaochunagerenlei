import { generateAiNames } from "./names";
import type {
  CreateGameInput,
  EliminationRecord,
  GameState,
  Participant,
  Phase2Context,
  Phase2Statement,
  RandomSource,
  SpeechRecord,
  VoteRecord,
} from "./types";

export const PLAYER_ID = "player";

function createId(prefix: string, rng: RandomSource = Math.random) {
  return `${prefix}-${Math.floor(rng() * 1_000_000_000).toString(36)}`;
}

function pickOne<T>(items: T[], rng: RandomSource) {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: T[], rng: RandomSource) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function nowIso(value?: string) {
  return value ?? new Date().toISOString();
}

function activeParticipants(state: GameState) {
  return state.participants.filter((participant) => participant.active);
}

function participantName(state: GameState, id: string) {
  return state.participants.find((participant) => participant.id === id)?.name ?? id;
}

function voteLeaders(votes: VoteRecord[]) {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + 1);
  }

  const max = Math.max(...counts.values());
  return [...counts.entries()]
    .filter(([, count]) => count === max)
    .map(([id]) => id);
}

export function createGame(input: CreateGameInput): GameState {
  const rng = input.rng ?? Math.random;
  const playerName = input.playerName.trim();

  if (input.playerCount < 4 || input.playerCount > 10) {
    throw new Error("PLAYER_COUNT_OUT_OF_RANGE");
  }

  if (!playerName) {
    throw new Error("PLAYER_NAME_REQUIRED");
  }

  const participantIds = [
    PLAYER_ID,
    ...Array.from({ length: input.playerCount - 1 }, (_, index) => `ai-${index + 1}`),
  ];
  const undercoverId = pickOne(participantIds, rng);
  const aiNames = generateAiNames(input.playerCount - 1, input.locale, rng);
  const participants: Participant[] = [
    {
      id: PLAYER_ID,
      name: playerName,
      kind: "human",
      role: undercoverId === PLAYER_ID ? "undercover" : "civilian",
      word:
        undercoverId === PLAYER_ID
          ? input.wordPair.undercoverWord
          : input.wordPair.commonWord,
      active: true,
    },
    ...aiNames.map((name, index) => {
      const id = `ai-${index + 1}`;
      return {
        id,
        name,
        kind: "ai" as const,
        role: undercoverId === id ? ("undercover" as const) : ("civilian" as const),
        word:
          undercoverId === id
            ? input.wordPair.undercoverWord
            : input.wordPair.commonWord,
        active: true,
      };
    }),
  ];
  const timestamp = nowIso(input.now);

  return {
    id: createId("game", rng),
    locale: input.locale,
    playerId: PLAYER_ID,
    wordPair: input.wordPair,
    participants,
    undercoverId,
    speakingOrder: shuffle(participantIds, rng),
    currentSpeakerIndex: 0,
    phase1Round: 1,
    stage: "phase1_speech",
    speeches: [],
    phase1Votes: [],
    eliminations: [],
    phase2Statements: [],
    phase2Votes: [],
    result: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getCurrentSpeaker(state: GameState) {
  const speakerId = state.speakingOrder[state.currentSpeakerIndex];
  return state.participants.find((participant) => participant.id === speakerId);
}

export function recordSpeech(
  state: GameState,
  speakerId: string,
  text: string,
  now?: string,
  rng: RandomSource = Math.random,
): GameState {
  if (state.stage !== "phase1_speech") {
    throw new Error("INVALID_STAGE");
  }

  const currentSpeaker = getCurrentSpeaker(state);
  if (!currentSpeaker || currentSpeaker.id !== speakerId) {
    throw new Error("UNEXPECTED_SPEAKER");
  }

  const speech: SpeechRecord = {
    id: createId("speech", rng),
    round: state.phase1Round,
    speakerId,
    text: text.trim(),
    createdAt: nowIso(now),
  };
  const isRoundDone = state.currentSpeakerIndex >= state.speakingOrder.length - 1;

  return {
    ...state,
    speeches: [...state.speeches, speech],
    stage: isRoundDone ? "phase1_vote" : "phase1_speech",
    currentSpeakerIndex: isRoundDone ? 0 : state.currentSpeakerIndex + 1,
    updatedAt: speech.createdAt,
  };
}

export function recordPhase1Votes(
  state: GameState,
  votes: Array<Omit<VoteRecord, "id" | "phase" | "round" | "createdAt">>,
  now?: string,
  rng: RandomSource = Math.random,
): GameState {
  if (state.stage !== "phase1_vote") {
    throw new Error("INVALID_STAGE");
  }

  const timestamp = nowIso(now);
  const activeIds = activeParticipants(state).map((participant) => participant.id);
  const phaseVotes = votes
    .filter((vote) => activeIds.includes(vote.voterId))
    .map<VoteRecord>((vote) => ({
      ...vote,
      id: createId("vote", rng),
      phase: "phase1",
      round: state.phase1Round,
      createdAt: timestamp,
    }));
  const leaders = voteLeaders(phaseVotes);
  if (leaders.length === 0) {
    throw new Error("NO_VALID_VOTES");
  }
  const eliminatedId = pickOne(leaders, rng);
  const elimination: EliminationRecord = {
    id: createId("elim", rng),
    round: state.phase1Round,
    eliminatedId,
    tiedIds: leaders,
    reason: `${participantName(state, eliminatedId)} received the top vote count.`,
    createdAt: timestamp,
  };
  const participants = state.participants.map((participant) =>
    participant.id === eliminatedId
      ? { ...participant, active: false }
      : participant,
  );
  const nextBase: GameState = {
    ...state,
    participants,
    phase1Votes: [...state.phase1Votes, ...phaseVotes],
    eliminations: [...state.eliminations, elimination],
    updatedAt: timestamp,
  };
  const player = nextBase.participants.find((participant) => participant.id === PLAYER_ID);
  const undercover = nextBase.participants.find(
    (participant) => participant.id === nextBase.undercoverId,
  );
  const nonUndercoverActive = nextBase.participants.filter(
    (participant) => participant.active && participant.role === "civilian",
  ).length;

  if (!player?.active) {
    return finishGame(nextBase, "phase1_player_lost", ["phase1Lose"], leaders);
  }

  if (!undercover?.active) {
    return startPhase2(nextBase, rng);
  }

  if (undercover.active && nonUndercoverActive <= 1) {
    return player.role === "undercover"
      ? startPhase2(nextBase, rng)
      : finishGame(nextBase, "phase1_player_lost", ["phase1Lose"], leaders);
  }

  const nextOrder = shuffle(
    nextBase.participants
      .filter((participant) => participant.active)
      .map((participant) => participant.id),
    rng,
  );

  return {
    ...nextBase,
    speakingOrder: nextOrder,
    currentSpeakerIndex: 0,
    phase1Round: nextBase.phase1Round + 1,
    stage: "phase1_speech",
  };
}

function startPhase2(state: GameState, rng: RandomSource): GameState {
  const order = shuffle(
    state.participants
      .filter((participant) => participant.active)
      .map((participant) => participant.id),
    rng,
  );

  return {
    ...state,
    speakingOrder: order,
    currentSpeakerIndex: 0,
    stage: "phase2_defense",
  };
}

function finishGame(
  state: GameState,
  outcome: "phase1_player_lost" | "phase2_player_won" | "phase2_player_lost",
  message: ["phase1Lose"] | ["phase2Win"] | ["phase2Lose"],
  topVotedIds: string[],
): GameState {
  return {
    ...state,
    stage: "final",
    result: {
      outcome,
      messageKey: message[0],
      playerTopVoted: topVotedIds.includes(PLAYER_ID),
      topVotedIds,
    },
  };
}

export function recordPhase2Statement(
  state: GameState,
  statement: Omit<Phase2Statement, "id" | "createdAt">,
  now?: string,
  rng: RandomSource = Math.random,
): GameState {
  if (state.stage !== "phase2_defense") {
    throw new Error("INVALID_STAGE");
  }

  const currentSpeaker = getCurrentSpeaker(state);
  if (!currentSpeaker || currentSpeaker.id !== statement.speakerId) {
    throw new Error("UNEXPECTED_SPEAKER");
  }

  const timestamp = nowIso(now);
  const record: Phase2Statement = {
    ...statement,
    id: createId("defense", rng),
    createdAt: timestamp,
  };
  const isRoundDone = state.currentSpeakerIndex >= state.speakingOrder.length - 1;

  return {
    ...state,
    phase2Statements: [...state.phase2Statements, record],
    stage: isRoundDone ? "phase2_vote" : "phase2_defense",
    currentSpeakerIndex: isRoundDone ? 0 : state.currentSpeakerIndex + 1,
    updatedAt: timestamp,
  };
}

export function recordPhase2Votes(
  state: GameState,
  votes: Array<Omit<VoteRecord, "id" | "phase" | "round" | "createdAt">>,
  now?: string,
  rng: RandomSource = Math.random,
): GameState {
  if (state.stage !== "phase2_vote") {
    throw new Error("INVALID_STAGE");
  }

  const timestamp = nowIso(now);
  const activeIds = activeParticipants(state).map((participant) => participant.id);
  const phaseVotes = votes
    .filter((vote) => activeIds.includes(vote.voterId))
    .map<VoteRecord>((vote) => ({
      ...vote,
      id: createId("vote", rng),
      phase: "phase2",
      round: 1,
      createdAt: timestamp,
    }));
  const leaders = voteLeaders(phaseVotes);
  if (leaders.length === 0) {
    throw new Error("NO_VALID_VOTES");
  }
  const playerLost = leaders.includes(PLAYER_ID);

  return finishGame(
    {
      ...state,
      phase2Votes: [...state.phase2Votes, ...phaseVotes],
      updatedAt: timestamp,
    },
    playerLost ? "phase2_player_lost" : "phase2_player_won",
    playerLost ? ["phase2Lose"] : ["phase2Win"],
    leaders,
  );
}

export function buildPhase2Context(state: GameState): Phase2Context {
  return {
    wordPair: state.wordPair,
    participants: state.participants.map(({ id, name, kind, active }) => ({
      id,
      name,
      kind,
      active,
    })),
    speeches: state.speeches,
    phase1Votes: state.phase1Votes,
    eliminations: state.eliminations,
  };
}

export function getVoteCandidates(state: GameState, voterId: string) {
  return state.participants.filter(
    (participant) => participant.active && participant.id !== voterId,
  );
}

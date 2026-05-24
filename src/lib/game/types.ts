export type Locale = "zh-CN" | "en-US";

export type ParticipantKind = "human" | "ai";
export type Role = "civilian" | "undercover";
export type GameStage =
  | "phase1_speech"
  | "phase1_vote"
  | "phase2_defense"
  | "phase2_vote"
  | "final";

export type GameOutcome =
  | "phase1_player_lost"
  | "phase2_player_won"
  | "phase2_player_lost";

export type WordPair = {
  commonWord: string;
  undercoverWord: string;
  category: string;
  sceneIntro: string;
};

export type AiPersona = {
  label: string;
  speakingStyle: string;
  catchphrases: string[];
  reasoningStyle: string;
  votingBias: string;
};

export type Participant = {
  id: string;
  name: string;
  kind: ParticipantKind;
  role: Role;
  word: string;
  active: boolean;
  persona?: AiPersona;
};

export type SpeechRecord = {
  id: string;
  round: number;
  speakerId: string;
  text: string;
  createdAt: string;
};

export type VoteRecord = {
  id: string;
  phase: "phase1" | "phase2";
  round: number;
  voterId: string;
  targetId: string;
  reason: string;
  createdAt: string;
};

export type EliminationRecord = {
  id: string;
  phase: "phase1" | "phase2";
  round: number;
  eliminatedId: string;
  tiedIds: string[];
  reason: string;
  createdAt: string;
};

export type TieRecord = {
  id: string;
  phase: "phase1" | "phase2";
  round: number;
  tiedIds: string[];
  reason: string;
  createdAt: string;
};

export type Phase2Statement = {
  id: string;
  round: number;
  speakerId: string;
  claim: string;
  suspicionTargetId: string;
  suspicionReason: string;
  contextAnchors: string[];
  createdAt: string;
};

export type GameResult = {
  outcome: GameOutcome;
  messageKey: "phase1Lose" | "phase2Win" | "phase2Lose";
  playerTopVoted: boolean;
  topVotedIds: string[];
};

export type GameState = {
  id: string;
  locale: Locale;
  playerId: string;
  wordPair: WordPair;
  participants: Participant[];
  undercoverId: string;
  speakingOrder: string[];
  currentSpeakerIndex: number;
  phase1Round: number;
  phase2Round: number;
  stage: GameStage;
  speeches: SpeechRecord[];
  phase1Votes: VoteRecord[];
  eliminations: EliminationRecord[];
  tieRecords: TieRecord[];
  phase2Statements: Phase2Statement[];
  phase2Votes: VoteRecord[];
  result: GameResult | null;
  createdAt: string;
  updatedAt: string;
};

export type RandomSource = () => number;

export type CreateGameInput = {
  locale: Locale;
  playerName: string;
  playerCount: number;
  wordPair: WordPair;
  now?: string;
  rng?: RandomSource;
};

export type Phase2Context = {
  participants: Array<Pick<Participant, "id" | "name" | "active">>;
  speeches: SpeechRecord[];
  phase1Votes: VoteRecord[];
  eliminations: EliminationRecord[];
  tieRecords: TieRecord[];
};

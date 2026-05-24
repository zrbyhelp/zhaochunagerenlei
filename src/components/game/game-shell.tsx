"use client";

import { format } from "date-fns";
import { enUS, zhCN, type Locale as DateFnsLocale } from "date-fns/locale";
import {
  Bot,
  Loader2,
  RefreshCcw,
  Send,
  ShieldQuestion,
  Sparkles,
  User,
  Vote,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PLAYER_ID,
  buildPhase2Context,
  createGame,
  getCurrentSpeaker,
  getVoteCandidates,
  recordPhase1Votes,
  recordPhase2Statement,
  recordPhase2Votes,
  recordSpeech,
} from "@/lib/game/state";
import type {
  GameState,
  Locale,
  Participant,
  Phase2Statement,
  VoteRecord,
  WordPair,
} from "@/lib/game/types";
import type {
  Phase1VoteOutput,
  Phase1SpeechOutput,
  Phase2DefenseOutput,
  Phase2VoteOutput,
} from "@/lib/ai/schemas";

type ApiResult<T> = { result: T };
type WordPairResult = { wordPair: WordPair };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "REQUEST_FAILED");
  }

  return data as T;
}

function publicParticipants(state: GameState) {
  return state.participants.map(({ id, name, active }) => ({
    id,
    name,
    active,
  }));
}

function actorPayload(actor: Participant) {
  return {
    id: actor.id,
    name: actor.name,
    word: actor.word,
    persona: actor.persona,
  };
}

function candidatePayload(candidates: Participant[]) {
  return candidates.map(({ id, name }) => ({ id, name }));
}

export function GameShell() {
  const t = useTranslations("game");
  const locale = useLocale() as Locale;
  const [playerName, setPlayerName] = useState("");
  const [playerCount, setPlayerCount] = useState(6);
  const [state, setState] = useState<GameState | null>(null);
  const [speechText, setSpeechText] = useState("");
  const [defenseText, setDefenseText] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const autoActionKeyRef = useRef("");

  const player = state?.participants.find((participant) => participant.id === PLAYER_ID);
  const currentSpeaker = state ? getCurrentSpeaker(state) : null;
  const voteCandidates = useMemo(
    () => (state && currentSpeaker ? getVoteCandidates(state, currentSpeaker.id) : []),
    [state, currentSpeaker],
  );
  const dateLocale = locale === "zh-CN" ? zhCN : enUS;

  const showModelError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      toast.error(
        message === "MODEL_ENV_INVALID"
          ? t("configMissing")
          : t("modelError", { message }),
      );
    },
    [t],
  );

  const runAiSpeechFor = useCallback(
    async (stateSnapshot: GameState, speaker: Participant) => {
      setLoading(true);

      try {
        const data = await postJson<ApiResult<Phase1SpeechOutput>>("/api/ai/act", {
          action: "phase1Speech",
          locale,
          actor: actorPayload(speaker),
          candidates: candidatePayload(getVoteCandidates(stateSnapshot, speaker.id)),
          context: {
            round: stateSnapshot.phase1Round,
            participants: publicParticipants(stateSnapshot),
            previousSpeeches: stateSnapshot.speeches.filter(
              (speech) => speech.round === stateSnapshot.phase1Round,
            ),
          },
        });
        setState(recordSpeech(stateSnapshot, speaker.id, data.result.speech));
      } catch (error) {
        showModelError(error);
      } finally {
        setLoading(false);
      }
    },
    [locale, showModelError],
  );

  const runAiDefenseFor = useCallback(
    async (stateSnapshot: GameState, speaker: Participant) => {
      setLoading(true);

      try {
        const data = await postJson<ApiResult<Phase2DefenseOutput>>("/api/ai/act", {
          action: "phase2Defense",
          locale,
          actor: actorPayload(speaker),
          candidates: candidatePayload(getVoteCandidates(stateSnapshot, speaker.id)),
          context: {
            phaseOne: buildPhase2Context(stateSnapshot),
            previousPhaseTwoStatements: stateSnapshot.phase2Statements,
          },
        });
        setState(
          recordPhase2Statement(stateSnapshot, {
            speakerId: speaker.id,
            claim: data.result.claim,
            suspicionTargetId: data.result.suspicionTargetId,
            suspicionReason: data.result.suspicionReason,
            contextAnchors: data.result.contextAnchors,
          }),
        );
      } catch (error) {
        showModelError(error);
      } finally {
        setLoading(false);
      }
    },
    [locale, showModelError],
  );

  useEffect(() => {
    if (!state || loading) return;

    const speaker = getCurrentSpeaker(state);
    if (!speaker || speaker.kind !== "ai") return;

    if (state.stage === "phase1_speech") {
      const key = `${state.id}:phase1:${state.phase1Round}:${state.currentSpeakerIndex}:${speaker.id}:${state.speeches.length}`;
      if (autoActionKeyRef.current === key) return;
      autoActionKeyRef.current = key;
      void runAiSpeechFor(state, speaker);
    }

    if (state.stage === "phase2_defense") {
      const key = `${state.id}:phase2:${state.currentSpeakerIndex}:${speaker.id}:${state.phase2Statements.length}`;
      if (autoActionKeyRef.current === key) return;
      autoActionKeyRef.current = key;
      void runAiDefenseFor(state, speaker);
    }
  }, [loading, runAiDefenseFor, runAiSpeechFor, state]);

  async function startGame() {
    if (!playerName.trim()) {
      toast.error(t("invalidName"));
      return;
    }

    setLoading(true);
    try {
      const { wordPair } = await postJson<WordPairResult>("/api/ai/word-pair", {
        locale,
      });
      const next = createGame({
        locale,
        playerName,
        playerCount,
        wordPair,
      });
      autoActionKeyRef.current = "";
      setState(next);
      setSelectedTarget("");
      setSpeechText("");
      setDefenseText("");
    } catch (error) {
      showModelError(error);
    } finally {
      setLoading(false);
    }
  }

  function resetGame() {
    autoActionKeyRef.current = "";
    setState(null);
    setSpeechText("");
    setDefenseText("");
    setSelectedTarget("");
  }

  function submitPlayerSpeech() {
    if (!state || !currentSpeaker || !speechText.trim()) return;
    setState(recordSpeech(state, currentSpeaker.id, speechText));
    setSpeechText("");
  }

  async function completePhase1Vote() {
    if (!state || !player) return;
    const target = selectedTarget || getVoteCandidates(state, PLAYER_ID)[0]?.id;
    if (!target) return;

    setLoading(true);
    try {
      const votes: Array<Omit<VoteRecord, "id" | "phase" | "round" | "createdAt">> = [
        {
          voterId: PLAYER_ID,
          targetId: target,
          reason: t("voted"),
        },
      ];

      for (const actor of state.participants.filter(
        (participant) => participant.active && participant.kind === "ai",
      )) {
        const data = await postJson<ApiResult<Phase1VoteOutput>>("/api/ai/act", {
          action: "phase1Vote",
          locale,
          actor: actorPayload(actor),
          candidates: candidatePayload(getVoteCandidates(state, actor.id)),
          context: {
            round: state.phase1Round,
            participants: publicParticipants(state),
            speeches: state.speeches,
            previousVotes: state.phase1Votes,
            eliminations: state.eliminations,
          },
        });
        votes.push({
          voterId: actor.id,
          targetId: data.result.targetId,
          reason: t("voted"),
        });
      }

      autoActionKeyRef.current = "";
      setState(recordPhase1Votes(state, votes));
      setSelectedTarget("");
    } catch (error) {
      showModelError(error);
    } finally {
      setLoading(false);
    }
  }

  function submitPlayerDefense() {
    if (!state || !currentSpeaker || !defenseText.trim()) return;
    const target = selectedTarget || getVoteCandidates(state, PLAYER_ID)[0]?.id;
    if (!target) return;
    setState(
      recordPhase2Statement(state, {
        speakerId: currentSpeaker.id,
        claim: defenseText,
        suspicionTargetId: target,
        suspicionReason: defenseText,
        contextAnchors: [t("stageContext")],
      }),
    );
    setDefenseText("");
    setSelectedTarget("");
  }

  async function completePhase2Vote() {
    if (!state) return;
    const target = selectedTarget || getVoteCandidates(state, PLAYER_ID)[0]?.id;
    if (!target) return;

    setLoading(true);
    try {
      const votes: Array<Omit<VoteRecord, "id" | "phase" | "round" | "createdAt">> = [
        {
          voterId: PLAYER_ID,
          targetId: target,
          reason: t("playerVoteReason"),
        },
      ];

      for (const actor of state.participants.filter(
        (participant) => participant.active && participant.kind === "ai",
      )) {
        const data = await postJson<ApiResult<Phase2VoteOutput>>("/api/ai/act", {
          action: "phase2Vote",
          locale,
          actor: actorPayload(actor),
          candidates: candidatePayload(getVoteCandidates(state, actor.id)),
          context: {
            phaseOne: buildPhase2Context(state),
            phaseTwoStatements: state.phase2Statements,
          },
        });
        votes.push({
          voterId: actor.id,
          targetId: data.result.targetId,
          reason: data.result.reason,
        });
      }

      setState(recordPhase2Votes(state, votes));
      setSelectedTarget("");
    } catch (error) {
      showModelError(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-3 px-3 pb-5 sm:gap-4 sm:px-6 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel flex min-h-[calc(100dvh-92px)] flex-col overflow-hidden lg:min-h-[720px]">
        <div className="border-b border-[var(--line)] p-4 sm:p-5">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--accent)]">
            {state?.stage?.startsWith("phase2") ? t("phase2") : t("phase1")}
          </p>
          <h1 className="text-2xl font-semibold text-balance sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-[var(--muted-foreground)] sm:mt-3 sm:text-sm sm:leading-6">
            {t("subtitle")}
          </p>
        </div>

        {!state ? (
          <SetupPanel
            playerName={playerName}
            playerCount={playerCount}
            loading={loading}
            onNameChange={setPlayerName}
            onCountChange={setPlayerCount}
            onStart={startGame}
          />
        ) : (
          <>
            <MobilePlayerTip state={state} />
            <ChatTimeline
              state={state}
              currentSpeaker={currentSpeaker}
              loading={loading}
              dateLocale={dateLocale}
            />
            <div className="border-t border-[var(--line)] bg-[var(--panel-strong)] p-3 sm:p-4">
              {state.stage === "phase1_speech" && currentSpeaker ? (
                currentSpeaker.id === PLAYER_ID ? (
                  <SpeechComposer
                    text={speechText}
                    onTextChange={setSpeechText}
                    onSubmit={submitPlayerSpeech}
                  />
                ) : (
                  <TypingStatus speaker={currentSpeaker} loading={loading} />
                )
              ) : null}
              {state.stage === "phase1_vote" ? (
                <VotePanel
                  title={t("phase1VoteTitle")}
                  help={t("phase1VoteHelp")}
                  candidates={getVoteCandidates(state, PLAYER_ID)}
                  selectedTarget={selectedTarget}
                  loading={loading}
                  onSelect={setSelectedTarget}
                  onComplete={completePhase1Vote}
                />
              ) : null}
              {state.stage === "phase2_defense" && currentSpeaker ? (
                currentSpeaker.id === PLAYER_ID ? (
                  <DefenseComposer
                    candidates={voteCandidates}
                    text={defenseText}
                    selectedTarget={selectedTarget}
                    onTextChange={setDefenseText}
                    onSelect={setSelectedTarget}
                    onSubmit={submitPlayerDefense}
                  />
                ) : (
                  <TypingStatus speaker={currentSpeaker} loading={loading} />
                )
              ) : null}
              {state.stage === "phase2_vote" ? (
                <VotePanel
                  title={t("phase2VoteTitle")}
                  help={t("phase2VoteHelp")}
                  candidates={getVoteCandidates(state, PLAYER_ID)}
                  selectedTarget={selectedTarget}
                  loading={loading}
                  onSelect={setSelectedTarget}
                  onComplete={completePhase2Vote}
                />
              ) : null}
              {state.stage === "final" ? (
                <ResultPanel state={state} onRestart={resetGame} />
              ) : null}
            </div>
          </>
        )}
      </section>

      <aside className="hidden content-start gap-4 lg:grid">
        {state ? (
          <>
            <PlayerSecret state={state} />
            <ParticipantsPanel state={state} />
            <StageHint state={state} />
          </>
        ) : (
          <div className="panel p-5">
            <div className="scan-line mb-4" />
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              {t("hiddenForPlayer")}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              {t("aiNameNote")}
            </p>
          </div>
        )}
      </aside>
    </main>
  );
}

function SetupPanel({
  playerName,
  playerCount,
  loading,
  onNameChange,
  onCountChange,
  onStart,
}: {
  playerName: string;
  playerCount: number;
  loading: boolean;
  onNameChange: (value: string) => void;
  onCountChange: (value: number) => void;
  onStart: () => void;
}) {
  const t = useTranslations("game");
  const countOptions = [4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="grid max-w-xl gap-4 p-4 sm:p-5">
      <h2 className="text-xl font-semibold">{t("setupTitle")}</h2>
      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted-foreground)]">{t("playerName")}</span>
        <input
          className="field"
          value={playerName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t("playerNamePlaceholder")}
        />
      </label>
      <fieldset className="grid gap-2 text-sm">
        <legend className="text-[var(--muted-foreground)]">{t("memberCount")}</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" data-testid="member-count-picker">
          {countOptions.map((count) => (
            <button
              aria-pressed={playerCount === count}
              className={`h-10 rounded-lg border text-sm font-semibold transition ${
                playerCount === count
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "border-[var(--line)] bg-[var(--panel-strong)] text-[var(--foreground)] hover:bg-[var(--panel)]"
              }`}
              key={count}
              onClick={() => onCountChange(count)}
              type="button"
            >
              {t("memberCountOption", { count })}
            </button>
          ))}
        </div>
      </fieldset>
      <Button type="button" disabled={loading} onClick={onStart}>
        {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldQuestion size={16} />}
        {loading ? t("starting") : t("start")}
      </Button>
    </div>
  );
}

function PlayerSecret({ state }: { state: GameState }) {
  const t = useTranslations("game");
  const player = state.participants.find((participant) => participant.id === PLAYER_ID);

  if (!player) return null;

  return (
    <section className="panel grid gap-3 p-4">
      <Info label={t("yourWord")} value={player.word} />
      <Info label={t("round", { round: state.phase1Round })} value={t("inProgress")} />
    </section>
  );
}

function MobilePlayerTip({ state }: { state: GameState }) {
  const t = useTranslations("game");
  const player = state.participants.find((participant) => participant.id === PLAYER_ID);

  if (!player) return null;

  return (
    <section
      className="grid grid-cols-2 gap-2 border-b border-[var(--line)] bg-[var(--panel-strong)] p-3 lg:hidden"
      data-testid="mobile-player-tip"
    >
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <span className="block text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">
          {t("yourWord")}
        </span>
        <strong className="mt-0.5 block truncate text-base text-[var(--foreground)]">
          {player.word}
        </strong>
      </div>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
        <span className="block text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">
          {t("round", { round: state.phase1Round })}
        </span>
        <strong className="mt-0.5 block truncate text-base text-[var(--foreground)]">
          {t("inProgress")}
        </strong>
      </div>
    </section>
  );
}

export function ChatTimeline({
  state,
  currentSpeaker,
  loading,
  dateLocale,
}: {
  state: GameState;
  currentSpeaker: Participant | null | undefined;
  loading: boolean;
  dateLocale: DateFnsLocale;
}) {
  const t = useTranslations("game");
  const records = buildTimelineRecords(state);
  const scrollRef = useRef<HTMLDivElement>(null);
  const showTyping =
    loading &&
    currentSpeaker?.kind === "ai" &&
    (state.stage === "phase1_speech" || state.stage === "phase2_defense");
  const lastRecord = records.at(-1);
  const lastRecordKey = lastRecord ? `${lastRecord.type}:${lastRecord.record.id}` : "empty";

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTop = element.scrollHeight;
  }, [lastRecordKey, records.length, showTyping, state.stage]);

  return (
    <div
      ref={scrollRef}
      className="h-[360px] overflow-y-auto p-3 sm:h-[520px] sm:p-5 lg:h-[560px]"
      data-testid="chat-timeline"
    >
      {records.length === 0 ? (
        <div className="grid h-full min-h-80 place-items-center rounded-lg border border-dashed border-[var(--line)] p-8 text-center">
          <div>
            <Sparkles className="mx-auto mb-3 text-[var(--accent)]" size={28} />
            <p className="text-sm text-[var(--muted-foreground)]">{t("noActivity")}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {records.map((item) => (
            <TimelineItem
              key={`${item.type}-${item.record.id}`}
              state={state}
              item={item}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
      {showTyping && currentSpeaker ? (
        <div className="mt-4">
          <TypingStatus speaker={currentSpeaker} loading={loading} />
        </div>
      ) : null}
    </div>
  );
}

function buildTimelineRecords(state: GameState) {
  return [
    ...state.speeches.map((record) => ({ type: "speech" as const, createdAt: record.createdAt, record })),
    ...state.phase2Statements.map((record) => ({ type: "defense" as const, createdAt: record.createdAt, record })),
    ...state.eliminations.map((record) => ({ type: "elimination" as const, createdAt: record.createdAt, record })),
    ...state.phase1Votes.map((record) => ({ type: "vote" as const, createdAt: record.createdAt, record })),
    ...state.phase2Votes.map((record) => ({ type: "vote" as const, createdAt: record.createdAt, record })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function TimelineItem({
  state,
  item,
  dateLocale,
}: {
  state: GameState;
  item:
    | { type: "speech"; createdAt: string; record: GameState["speeches"][number] }
    | { type: "defense"; createdAt: string; record: Phase2Statement }
    | { type: "elimination"; createdAt: string; record: GameState["eliminations"][number] }
    | { type: "vote"; createdAt: string; record: VoteRecord };
  dateLocale: DateFnsLocale;
}) {
  const t = useTranslations("game");
  const name = (id: string) =>
    state.participants.find((participant) => participant.id === id)?.name ?? id;

  if (item.type === "speech") {
    return (
      <ChatBubble
        speaker={state.participants.find((participant) => participant.id === item.record.speakerId)}
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        body={item.record.text}
      />
    );
  }

  if (item.type === "defense") {
    return (
      <ChatBubble
        speaker={state.participants.find((participant) => participant.id === item.record.speakerId)}
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        body={item.record.claim}
        meta={
          <>
            <span className="block font-semibold text-[var(--foreground)]">
              {t("suspectsLabel")}
              {name(item.record.suspicionTargetId)}
            </span>
            <span className="mt-1 block">
              {t("suspicionReasonLabel")}
              {item.record.suspicionReason}
            </span>
          </>
        }
      />
    );
  }

  if (item.type === "elimination") {
    return (
      <SystemEvent
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        body={`${t("eliminated")}: ${name(item.record.eliminatedId)}`}
      />
    );
  }

  const voteBody =
    item.record.phase === "phase1"
      ? `${name(item.record.voterId)} -> ${name(item.record.targetId)}`
      : `${name(item.record.voterId)} -> ${name(item.record.targetId)}：${item.record.reason}`;

  return (
    <SystemEvent
      time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
      body={voteBody}
    />
  );
}

function ChatBubble({
  speaker,
  time,
  body,
  meta,
}: {
  speaker?: Participant;
  time: string;
  body: string;
  meta?: ReactNode;
}) {
  const isPlayer = speaker?.id === PLAYER_ID;

  return (
    <article className={`flex gap-3 ${isPlayer ? "justify-end" : "justify-start"}`}>
      {!isPlayer ? <Avatar participant={speaker} /> : null}
      <div className={`max-w-[78%] ${isPlayer ? "text-right" : ""}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{speaker?.name}</span>
          <time>{time}</time>
        </div>
        <p className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-3 text-left text-sm leading-6">
          {body}
        </p>
        {meta ? (
          <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left text-xs leading-5 text-[var(--muted-foreground)]">
            {meta}
          </div>
        ) : null}
      </div>
      {isPlayer ? <Avatar participant={speaker} /> : null}
    </article>
  );
}

function SystemEvent({ time, body }: { time: string; body: string }) {
  return (
    <div className="mx-auto max-w-[86%] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-center text-xs text-[var(--muted-foreground)]">
      <time className="mr-2">{time}</time>
      <span>{body}</span>
    </div>
  );
}

function Avatar({ participant }: { participant?: Participant }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--accent)]">
      {participant?.kind === "human" ? <User size={17} /> : <Bot size={17} />}
    </div>
  );
}

function SpeechComposer({
  text,
  onTextChange,
  onSubmit,
}: {
  text: string;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("game");

  return (
    <div className="grid gap-3" data-testid="player-composer">
      <textarea
        className="field min-h-24 resize-y"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={t("speechPlaceholder")}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit}>
          <Send size={16} />
          {t("submitSpeech")}
        </Button>
      </div>
    </div>
  );
}

function DefenseComposer({
  candidates,
  text,
  selectedTarget,
  onTextChange,
  onSelect,
  onSubmit,
}: {
  candidates: Participant[];
  text: string;
  selectedTarget: string;
  onTextChange: (value: string) => void;
  onSelect: (value: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("game");

  return (
    <div className="grid gap-3" data-testid="player-composer">
      <textarea
        className="field min-h-24 resize-y"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={t("defensePlaceholder")}
      />
      <TargetSelect candidates={candidates} value={selectedTarget} onChange={onSelect} />
      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit}>
          <Send size={16} />
          {t("submitDefense")}
        </Button>
      </div>
    </div>
  );
}

function TypingStatus({
  speaker,
  loading,
}: {
  speaker: Participant;
  loading: boolean;
}) {
  const t = useTranslations("game");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 text-sm text-[var(--muted-foreground)]">
      <Avatar participant={speaker} />
      <span className="font-semibold text-[var(--foreground)]">{speaker.name}</span>
      {loading ? <Loader2 className="animate-spin text-[var(--accent)]" size={16} /> : null}
      <span>{t("aiTyping")}</span>
    </div>
  );
}

function VotePanel({
  title,
  help,
  candidates,
  selectedTarget,
  loading,
  onSelect,
  onComplete,
}: {
  title: string;
  help: string;
  candidates: Participant[];
  selectedTarget: string;
  loading: boolean;
  onSelect: (value: string) => void;
  onComplete: () => void;
}) {
  const t = useTranslations("game");

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{help}</p>
      </div>
      <TargetSelect candidates={candidates} value={selectedTarget} onChange={onSelect} />
      <Button type="button" disabled={loading} onClick={onComplete}>
        {loading ? <Loader2 className="animate-spin" size={16} /> : <Vote size={16} />}
        {loading ? t("generatingAi") : t("completeVote")}
      </Button>
    </div>
  );
}

function TargetSelect({
  candidates,
  value,
  onChange,
}: {
  candidates: Participant[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("game");

  return (
    <label className="grid gap-2 text-sm">
      <span className="text-[var(--muted-foreground)]">{t("suspicion")}</span>
      <select
        className="field"
        value={value || candidates[0]?.id || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ParticipantsPanel({ state }: { state: GameState }) {
  const t = useTranslations("game");

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--accent)]">
        {t("participants")}
      </h2>
      <div className="grid gap-2">
        {state.participants.map((participant) => (
          <div
            className="grid gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
            key={participant.id}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex min-w-0 items-center gap-2">
                {participant.kind === "human" ? <User size={15} /> : <Bot size={15} />}
                <span className="truncate">{participant.name}</span>
              </span>
              <span className={participant.active ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
                {participant.active ? t("active") : t("eliminated")}
              </span>
            </div>
            {participant.persona ? (
              <span className="truncate text-xs text-[var(--muted-foreground)]">
                {participant.persona.label}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function StageHint({ state }: { state: GameState }) {
  const t = useTranslations("game");

  return (
    <section className="panel p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-[var(--accent)]">
        {state.stage.startsWith("phase2") ? t("phase2") : t("phase1")}
      </h2>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
        {state.stage.startsWith("phase2") ? t("stageContext") : t("hiddenForPlayer")}
      </p>
    </section>
  );
}

function ResultPanel({
  state,
  onRestart,
}: {
  state: GameState;
  onRestart: () => void;
}) {
  const t = useTranslations("game");
  const isWin = state.result?.outcome === "phase2_player_won";

  return (
    <div className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-5">
      <h2 className={isWin ? "text-2xl font-semibold text-[var(--accent)]" : "text-2xl font-semibold text-[var(--danger)]"}>
        {state.result ? t(state.result.messageKey) : t("winnerLose")}
      </h2>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
        {isWin ? t("winnerWin") : t("winnerLose")}
      </p>
      <Button type="button" variant="secondary" onClick={onRestart}>
        <RefreshCcw size={16} />
        {t("restart")}
      </Button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs uppercase text-[var(--muted-foreground)]">{label}</span>
      <strong className="text-lg">{value}</strong>
    </div>
  );
}

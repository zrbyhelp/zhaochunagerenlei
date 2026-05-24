"use client";

import { format } from "date-fns";
import { enUS, zhCN, type Locale as DateFnsLocale } from "date-fns/locale";
import {
  Bot,
  CircleDot,
  Loader2,
  RefreshCcw,
  ShieldQuestion,
  User,
  Vote,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
  Phase1SpeechOutput,
  Phase2DefenseOutput,
  VoteActionOutput,
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
  return state.participants.map(({ id, name, kind, active }) => ({
    id,
    name,
    kind,
    active,
  }));
}

function actorPayload(actor: Participant) {
  return {
    id: actor.id,
    name: actor.name,
    word: actor.word,
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

  const player = state?.participants.find((participant) => participant.id === PLAYER_ID);
  const currentSpeaker = state ? getCurrentSpeaker(state) : null;
  const voteCandidates = useMemo(
    () => (state && currentSpeaker ? getVoteCandidates(state, currentSpeaker.id) : []),
    [state, currentSpeaker],
  );
  const dateLocale = locale === "zh-CN" ? zhCN : enUS;

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
      setState(next);
      setSelectedTarget("");
      setSpeechText("");
      setDefenseText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      toast.error(message === "MODEL_ENV_INVALID" ? t("configMissing") : t("modelError", { message }));
    } finally {
      setLoading(false);
    }
  }

  function resetGame() {
    setState(null);
    setSpeechText("");
    setDefenseText("");
    setSelectedTarget("");
  }

  async function generateAiSpeech() {
    if (!state || !currentSpeaker) return;
    setLoading(true);

    try {
      const data = await postJson<ApiResult<Phase1SpeechOutput>>("/api/ai/act", {
        action: "phase1Speech",
        locale,
        actor: actorPayload(currentSpeaker),
        candidates: candidatePayload(getVoteCandidates(state, currentSpeaker.id)),
        context: {
          round: state.phase1Round,
          participants: publicParticipants(state),
          previousSpeeches: state.speeches.filter(
            (speech) => speech.round === state.phase1Round,
          ),
        },
      });
      setState(recordSpeech(state, currentSpeaker.id, data.result.speech));
    } catch (error) {
      showModelError(error);
    } finally {
      setLoading(false);
    }
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
          reason: t("playerVoteReason"),
        },
      ];

      for (const actor of state.participants.filter(
        (participant) => participant.active && participant.kind === "ai",
      )) {
        const data = await postJson<ApiResult<VoteActionOutput>>("/api/ai/act", {
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
          reason: data.result.reason,
        });
      }

      setState(recordPhase1Votes(state, votes));
      setSelectedTarget("");
    } catch (error) {
      showModelError(error);
    } finally {
      setLoading(false);
    }
  }

  async function generateAiDefense() {
    if (!state || !currentSpeaker) return;
    setLoading(true);

    try {
      const data = await postJson<ApiResult<Phase2DefenseOutput>>("/api/ai/act", {
        action: "phase2Defense",
        locale,
        actor: actorPayload(currentSpeaker),
        candidates: candidatePayload(getVoteCandidates(state, currentSpeaker.id)),
        context: {
          phaseOne: buildPhase2Context(state),
          previousPhaseTwoStatements: state.phase2Statements,
        },
      });
      setState(
        recordPhase2Statement(state, {
          speakerId: currentSpeaker.id,
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
        const data = await postJson<ApiResult<VoteActionOutput>>("/api/ai/act", {
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

  function showModelError(error: unknown) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    toast.error(t("modelError", { message }));
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="panel min-h-[680px] overflow-hidden">
        <div className="border-b border-[var(--line)] p-5">
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--accent)]">
            {state?.stage?.startsWith("phase2") ? t("phase2") : t("phase1")}
          </p>
          <h1 className="text-3xl font-semibold text-balance">{t("title")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
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
          <div className="grid gap-5 p-5">
            <PlayerSecret state={state} />
            {state.stage === "phase1_speech" && currentSpeaker ? (
              <SpeechPanel
                currentSpeaker={currentSpeaker}
                loading={loading}
                text={speechText}
                onTextChange={setSpeechText}
                onSubmit={submitPlayerSpeech}
                onGenerate={generateAiSpeech}
              />
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
              <DefensePanel
                currentSpeaker={currentSpeaker}
                candidates={voteCandidates}
                loading={loading}
                text={defenseText}
                selectedTarget={selectedTarget}
                onTextChange={setDefenseText}
                onSelect={setSelectedTarget}
                onSubmit={submitPlayerDefense}
                onGenerate={generateAiDefense}
              />
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
        )}
      </section>

      <aside className="grid content-start gap-4">
        {state ? (
          <>
            <ParticipantsPanel state={state} />
            <ActivityPanel state={state} dateLocale={dateLocale} />
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

  return (
    <div className="grid max-w-xl gap-4 p-5">
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
      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted-foreground)]">{t("memberCount")}</span>
        <input
          className="field"
          min={4}
          max={10}
          type="number"
          value={playerCount}
          onChange={(event) => onCountChange(Number(event.target.value))}
        />
      </label>
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
    <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-4 sm:grid-cols-3">
      <Info label={t("yourWord")} value={player.word} />
      <Info label={t("yourRole")} value={t(player.role)} />
      <Info label={t("round", { round: state.phase1Round })} value={state.wordPair.category} />
    </div>
  );
}

function SpeechPanel({
  currentSpeaker,
  loading,
  text,
  onTextChange,
  onSubmit,
  onGenerate,
}: {
  currentSpeaker: Participant;
  loading: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onSubmit: () => void;
  onGenerate: () => void;
}) {
  const t = useTranslations("game");
  const isPlayer = currentSpeaker.id === PLAYER_ID;

  return (
    <div className="grid gap-4">
      <SpeakerHeader speaker={currentSpeaker} />
      {isPlayer ? (
        <>
          <textarea
            className="field min-h-32 resize-y"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={t("speechPlaceholder")}
          />
          <Button type="button" onClick={onSubmit}>
            <CircleDot size={16} />
            {t("submitSpeech")}
          </Button>
        </>
      ) : (
        <Button type="button" disabled={loading} onClick={onGenerate}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Bot size={16} />}
          {loading ? t("generatingAi") : t("generateSpeech")}
        </Button>
      )}
    </div>
  );
}

function DefensePanel({
  currentSpeaker,
  candidates,
  loading,
  text,
  selectedTarget,
  onTextChange,
  onSelect,
  onSubmit,
  onGenerate,
}: {
  currentSpeaker: Participant;
  candidates: Participant[];
  loading: boolean;
  text: string;
  selectedTarget: string;
  onTextChange: (value: string) => void;
  onSelect: (value: string) => void;
  onSubmit: () => void;
  onGenerate: () => void;
}) {
  const t = useTranslations("game");
  const isPlayer = currentSpeaker.id === PLAYER_ID;

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-xl font-semibold">{t("phase2DefenseTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          {t("phase2DefenseHelp")}
        </p>
      </div>
      <SpeakerHeader speaker={currentSpeaker} />
      {isPlayer ? (
        <>
          <textarea
            className="field min-h-32 resize-y"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={t("defensePlaceholder")}
          />
          <TargetSelect
            candidates={candidates}
            value={selectedTarget}
            onChange={onSelect}
          />
          <Button type="button" onClick={onSubmit}>
            <CircleDot size={16} />
            {t("submitDefense")}
          </Button>
        </>
      ) : (
        <Button type="button" disabled={loading} onClick={onGenerate}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Bot size={16} />}
          {loading ? t("generatingAi") : t("generateDefense")}
        </Button>
      )}
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
            className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
            key={participant.id}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              {participant.kind === "human" ? <User size={15} /> : <Bot size={15} />}
              <span className="truncate">{participant.name}</span>
            </span>
            <span className={participant.active ? "text-[var(--accent)]" : "text-[var(--danger)]"}>
              {participant.active ? t("active") : t("eliminated")}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanel({
  state,
  dateLocale,
}: {
  state: GameState;
  dateLocale: DateFnsLocale;
}) {
  const t = useTranslations("game");
  const records = [
    ...state.speeches.map((record) => ({ type: "speech" as const, createdAt: record.createdAt, record })),
    ...state.eliminations.map((record) => ({ type: "elimination" as const, createdAt: record.createdAt, record })),
    ...state.phase2Statements.map((record) => ({ type: "defense" as const, createdAt: record.createdAt, record })),
    ...state.phase1Votes.map((record) => ({ type: "vote" as const, createdAt: record.createdAt, record })),
    ...state.phase2Votes.map((record) => ({ type: "vote" as const, createdAt: record.createdAt, record })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <section className="panel max-h-[620px] overflow-auto p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--accent)]">
        {t("activity")}
      </h2>
      {records.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{t("noActivity")}</p>
      ) : (
        <div className="grid gap-3">
          {records.map((item) => (
            <ActivityItem
              key={`${item.type}-${item.record.id}`}
              state={state}
              item={item}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityItem({
  state,
  item,
  dateLocale,
}: {
  state: GameState;
  item:
    | { type: "speech"; createdAt: string; record: GameState["speeches"][number] }
    | { type: "elimination"; createdAt: string; record: GameState["eliminations"][number] }
    | { type: "defense"; createdAt: string; record: Phase2Statement }
    | { type: "vote"; createdAt: string; record: VoteRecord };
  dateLocale: DateFnsLocale;
}) {
  const t = useTranslations("game");
  const name = (id: string) =>
    state.participants.find((participant) => participant.id === id)?.name ?? id;

  if (item.type === "speech") {
    return (
      <LogItem
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        title={name(item.record.speakerId)}
        body={item.record.text}
      />
    );
  }

  if (item.type === "defense") {
    return (
      <LogItem
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        title={name(item.record.speakerId)}
        body={`${item.record.claim} ${t("suspicion")}: ${name(item.record.suspicionTargetId)}. ${item.record.suspicionReason}`}
      />
    );
  }

  if (item.type === "elimination") {
    return (
      <LogItem
        time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
        title={t("eliminated")}
        body={name(item.record.eliminatedId)}
      />
    );
  }

  return (
    <LogItem
      time={format(new Date(item.createdAt), "HH:mm:ss", { locale: dateLocale })}
      title={`${name(item.record.voterId)} -> ${name(item.record.targetId)}`}
      body={item.record.reason}
    />
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

function SpeakerHeader({ speaker }: { speaker: Participant }) {
  const t = useTranslations("game");

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-4">
      <span className="text-sm text-[var(--muted-foreground)]">{t("speaker")}</span>
      <span className="inline-flex items-center gap-2 font-semibold">
        {speaker.kind === "human" ? <User size={18} /> : <Bot size={18} />}
        {speaker.name}
      </span>
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

function LogItem({
  time,
  title,
  body,
}: {
  time: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
        <span className="truncate font-semibold text-[var(--foreground)]">{title}</span>
        <time>{time}</time>
      </div>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">{body}</p>
    </article>
  );
}

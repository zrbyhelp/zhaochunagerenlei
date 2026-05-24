import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { zhCN } from "date-fns/locale";
import { ThemeProvider } from "@/components/providers/theme-provider";
import {
  ChatTimeline,
  GameShell,
  isEliminatedForDisplay,
  isPhaseTwoView,
} from "@/components/game/game-shell";
import { PLAYER_ID } from "@/lib/game/state";
import type { GameState } from "@/lib/game/types";
import zhMessages from "@/messages/zh-CN.json";

function renderGame() {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <ThemeProvider>
        <GameShell />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

const baseTimelineState: GameState = {
  id: "game-1",
  locale: "zh-CN",
  playerId: PLAYER_ID,
  wordPair: {
    commonWord: "键盘",
    undercoverWord: "鼠标",
    category: "办公用品",
    sceneIntro: "一组日常办公用品。",
  },
  participants: [
    {
      id: PLAYER_ID,
      name: "臧浩然",
      kind: "human",
      role: "civilian",
      word: "键盘",
      active: true,
    },
    {
      id: "ai-1",
      name: "林澈",
      kind: "ai",
      role: "undercover",
      word: "鼠标",
      active: true,
      persona: {
        label: "轻松吐槽型",
        speakingStyle: "话比较短。",
        catchphrases: ["说实话"],
        reasoningStyle: "从日常体验切入。",
        votingBias: "跟风偏差：容易受已经出现的票影响。",
      },
    },
  ],
  undercoverId: "ai-1",
  speakingOrder: [PLAYER_ID, "ai-1"],
  currentSpeakerIndex: 0,
  phase1Round: 1,
  stage: "phase2_vote",
  speeches: [],
  phase1Votes: [],
  eliminations: [],
  phase2Statements: [
    {
      id: "defense-1",
      speakerId: "ai-1",
      claim: "我刚才说的是办公桌上很常见的东西，不是临时编的。",
      suspicionTargetId: PLAYER_ID,
      suspicionReason: "你一阶段投票太快，像是想顺着别人走。",
      contextAnchors: ["一阶段投票"],
      createdAt: "2026-01-01T00:00:01.000Z",
    },
  ],
  phase2Votes: [],
  result: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:01.000Z",
};

function renderTimeline(state: GameState = baseTimelineState) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <ChatTimeline
        state={state}
        currentSpeaker={state.participants[0]}
        loading={false}
        dateLocale={zhCN}
      />
    </NextIntlClientProvider>,
  );
}

describe("GameShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders setup controls and accepts a player name", async () => {
    const user = userEvent.setup();
    renderGame();

    const input = screen.getByPlaceholderText("输入你的代号");
    await user.type(input, "臧浩然");

    expect(input).toHaveValue("臧浩然");
    expect(screen.getByText("成员数量")).toBeInTheDocument();
    expect(screen.getByTestId("member-count-picker")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4人" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10人" })).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("auto-generates AI speech and keeps the player composer in the chat layout", async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/ai/word-pair")) {
          return Response.json({
            wordPair: {
              commonWord: "牙刷",
              undercoverWord: "牙膏",
              category: "生活物品",
              sceneIntro: "一组日常生活用品。",
            },
          });
        }

        return Response.json({
          result: {
            speech: "我脑子里先冒出来的是早上洗漱那一下，挺日常的。",
          },
        });
      }),
    );
    renderGame();

    await user.type(screen.getByPlaceholderText("输入你的代号"), "臧浩然");
    await user.click(screen.getByRole("button", { name: "启动审查" }));

    await waitFor(() => {
      expect(screen.getByText("我脑子里先冒出来的是早上洗漱那一下，挺日常的。")).toBeInTheDocument();
    });
    expect(screen.getByTestId("chat-timeline")).toHaveClass(
      "flex-1",
      "overflow-y-auto",
    );
    expect(screen.getByTestId("mobile-player-tip")).toHaveTextContent("你的词语");
    expect(screen.getByTestId("mobile-player-tip")).toHaveTextContent("第 1 轮");
    expect(screen.queryByText("你的身份")).not.toBeInTheDocument();
    expect(screen.queryByText("普通阵营")).not.toBeInTheDocument();
    expect(screen.queryByText("卧底阵营")).not.toBeInTheDocument();
    expect(screen.queryByText("生成 AI 发言")).not.toBeInTheDocument();
  });

  it("keeps chat records scrollable and moves to the latest message", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => 680,
    });

    const { rerender } = renderTimeline({
      ...baseTimelineState,
      phase2Statements: [],
    });
    const timeline = screen.getByTestId("chat-timeline");

    await waitFor(() => {
      expect(timeline.scrollTop).toBe(680);
    });

    rerender(
      <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
        <ChatTimeline
          state={baseTimelineState}
          currentSpeaker={baseTimelineState.participants[0]}
          loading={false}
          dateLocale={zhCN}
        />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(timeline.scrollTop).toBe(680);
    });
  });

  it("shows phase-two suspicion below the defense bubble", () => {
    renderTimeline();

    expect(screen.getByText("我刚才说的是办公桌上很常见的东西，不是临时编的。")).toBeInTheDocument();
    expect(screen.getByText("怀疑：臧浩然")).toBeInTheDocument();
    expect(screen.queryByText("理由：你一阶段投票太快，像是想顺着别人走。")).not.toBeInTheDocument();
  });

  it("keeps final phase-two display state after phase-two votes", () => {
    const finalState: GameState = {
      ...baseTimelineState,
      stage: "final",
      result: {
        outcome: "phase2_player_lost",
        messageKey: "phase2Lose",
        playerTopVoted: true,
        topVotedIds: [PLAYER_ID],
      },
    };

    expect(isPhaseTwoView(finalState)).toBe(true);
    expect(isEliminatedForDisplay(finalState, finalState.participants[0])).toBe(true);
    expect(isEliminatedForDisplay(finalState, finalState.participants[1])).toBe(false);
  });
});

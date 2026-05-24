import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  phase2Round: 1,
  stage: "phase2_vote",
  speeches: [],
  phase1Votes: [],
  eliminations: [],
  tieRecords: [],
  phase2Statements: [
    {
      id: "defense-1",
      round: 1,
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

function mockGameFetch(options: {
  phase1VoteTarget: (actorId: string) => string;
  phase2VoteTarget?: (actorId: string) => string;
  actionCounts: Record<string, number>;
  requests?: Array<{
    action?: string;
    actor?: { id: string; name: string };
    context?: Record<string, unknown>;
  }>;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/ai/word-pair")) {
        return Response.json({
          wordPair: {
            commonWord: "键盘",
            undercoverWord: "鼠标",
            category: "办公用品",
            sceneIntro: "一组日常办公用品。",
          },
        });
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        action?: string;
        actor?: { id: string; name: string };
        context?: Record<string, unknown>;
      };
      options.requests?.push(body);
      if (body.action) {
        options.actionCounts[body.action] = (options.actionCounts[body.action] ?? 0) + 1;
      }

      if (body.action === "phase1Speech") {
        return Response.json({
          result: {
            speech: `${body.actor?.name ?? "AI"}说这个东西挺常见，办公桌上经常碰到。`,
          },
        });
      }

      if (body.action === "phase1Vote") {
        return Response.json({
          result: { targetId: options.phase1VoteTarget(body.actor?.id ?? "") },
        });
      }

      if (body.action === "phase2Defense") {
        return Response.json({
          result: {
            claim: "我不是隐藏人类，我第一阶段的描述是按自己的词自然说的。",
            suspicionTargetId: PLAYER_ID,
            suspicionReason: "玩家二阶段解释有点像临场补逻辑。",
            contextAnchors: ["一阶段发言"],
          },
        });
      }

      return Response.json({
        result: {
          targetId: options.phase2VoteTarget?.(body.actor?.id ?? "") ?? PLAYER_ID,
          reason: "玩家二阶段解释有点像临场补逻辑。",
        },
      });
    }),
  );
}

async function startFourPlayerGame(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("输入你的代号"), "臧浩然");
  await user.click(screen.getByRole("button", { name: "4人" }));
  await user.click(screen.getByRole("button", { name: "启动审查" }));

  await waitFor(() => {
    expect(screen.getByPlaceholderText("描述你的词语，但不要直接说出答案。")).toBeInTheDocument();
  });
}

async function finishPhaseOne(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText("描述你的词语，但不要直接说出答案。"),
    "我想到的是办公桌上常见的小东西，用起来挺顺手。",
  );
  await user.click(screen.getByRole("button", { name: "提交发言" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "一阶段投票" })).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: "完成投票" }));
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

  it("shows tie restart events in the chat timeline", () => {
    renderTimeline({
      ...baseTimelineState,
      phase2Statements: [],
      tieRecords: [
        {
          id: "tie-1",
          phase: "phase2",
          round: 1,
          tiedIds: [PLAYER_ID, "ai-1"],
          reason: "Top vote count was tied; no one was eliminated.",
          createdAt: "2026-01-01T00:00:02.000Z",
        },
      ],
    });

    expect(
      screen.getByText("平票，本轮无人出局，重新开始一轮对话：臧浩然、林澈"),
    ).toBeInTheDocument();
  });

  it("restarts phase one on a tied vote without revealing the word pair", async () => {
    const user = userEvent.setup();
    const actionCounts: Record<string, number> = {};
    vi.spyOn(Math, "random").mockReturnValue(0.26);
    mockGameFetch({
      actionCounts,
      phase1VoteTarget: (actorId) => {
        if (actorId === "ai-1" || actorId === "ai-2") return PLAYER_ID;
        return "ai-1";
      },
    });
    renderGame();

    await startFourPlayerGame(user);
    await finishPhaseOne(user);

    await waitFor(() => {
      expect(screen.getByText(/平票，本轮无人出局/)).toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog", { name: "一阶段结束" })).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-player-tip")).toHaveTextContent("第 2 轮");
  });

  it("shows a phase-one success summary and waits for confirmation before AI phase two", async () => {
    const user = userEvent.setup();
    const actionCounts: Record<string, number> = {};
    const requests: Array<{
      action?: string;
      actor?: { id: string; name: string };
      context?: Record<string, unknown>;
    }> = [];
    vi.spyOn(Math, "random").mockReturnValue(0.26);
    mockGameFetch({
      actionCounts,
      requests,
      phase1VoteTarget: (actorId) => (actorId === "ai-1" ? "ai-2" : "ai-1"),
    });
    renderGame();

    await startFourPlayerGame(user);
    await finishPhaseOne(user);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "一阶段结束" })).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog", { name: "一阶段结束" });
    expect(within(dialog).getByText("普通词")).toBeInTheDocument();
    expect(within(dialog).getByText("键盘")).toBeInTheDocument();
    expect(within(dialog).getByText("卧底词")).toBeInTheDocument();
    expect(within(dialog).getByText("鼠标")).toBeInTheDocument();
    expect(within(dialog).getByText("出局成员")).toBeInTheDocument();
    expect(within(dialog).getByText("恭喜你进入第二轮。")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "进入二阶段" })).toBeInTheDocument();
    expect(actionCounts.phase2Defense ?? 0).toBe(0);
    const phase1VoteRequests = requests.filter((request) => request.action === "phase1Vote");
    expect(phase1VoteRequests.length).toBeGreaterThan(0);
    expect(
      phase1VoteRequests.every(
        (request) =>
          !("currentVotes" in (request.context ?? {})) &&
          Array.isArray(request.context?.previousVotes),
      ),
    ).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "进入二阶段" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "一阶段结束" })).not.toBeInTheDocument();
      expect(actionCounts.phase2Defense ?? 0).toBeGreaterThan(0);
    });
  });

  it("shows a phase-one failure summary and restarts from the modal", async () => {
    const user = userEvent.setup();
    const actionCounts: Record<string, number> = {};
    vi.spyOn(Math, "random").mockReturnValue(0);
    mockGameFetch({
      actionCounts,
      phase1VoteTarget: () => PLAYER_ID,
    });
    renderGame();

    await startFourPlayerGame(user);
    await finishPhaseOne(user);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "一阶段结束" })).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog", { name: "一阶段结束" });
    expect(within(dialog).getByText("胜败乃兵家常事，请重新开始。")).toBeInTheDocument();
    expect(within(dialog).getByText("普通词")).toBeInTheDocument();
    expect(within(dialog).getByText("卧底词")).toBeInTheDocument();
    expect(within(dialog).getByText("出局成员")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "进入二阶段" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "重新开始" }));

    expect(screen.getByRole("heading", { name: "创建对局" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "一阶段结束" })).not.toBeInTheDocument();
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

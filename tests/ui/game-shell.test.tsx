import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { GameShell } from "@/components/game/game-shell";
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

describe("GameShell", () => {
  it("renders setup controls and accepts a player name", async () => {
    const user = userEvent.setup();
    renderGame();

    const input = screen.getByPlaceholderText("输入你的代号");
    await user.type(input, "臧浩然");

    expect(input).toHaveValue("臧浩然");
    expect(screen.getByText("成员数量")).toBeInTheDocument();
  });
});

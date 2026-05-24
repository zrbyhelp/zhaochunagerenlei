import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AdminShell } from "@/components/game/admin-shell";
import { TopBar } from "@/components/game/top-bar";
import zhMessages from "@/messages/zh-CN.json";

const navigation = vi.hoisted(() => ({
  pathname: "/zh-CN/admin",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/i18n/routing", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    routing: {
      locales: ["zh-CN", "en-US"],
      defaultLocale: "zh-CN",
    },
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
      className?: string;
    }) => React.createElement("a", { href, ...props }, children),
  };
});

function renderWithMessages(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={zhMessages}>
      <ThemeProvider>{children}</ThemeProvider>
    </NextIntlClientProvider>,
  );
}

describe("navigation and admin", () => {
  beforeEach(() => {
    navigation.pathname = "/zh-CN/admin";
    navigation.replace.mockClear();
  });

  it("switches locale by replacing the route prefix", async () => {
    const user = userEvent.setup();
    renderWithMessages(<TopBar />);

    await user.selectOptions(screen.getByRole("combobox"), "en-US");

    expect(navigation.replace).toHaveBeenCalledWith("/en-US/admin");
  });

  it("shows GitHub link in the top bar", () => {
    renderWithMessages(<TopBar />);

    expect(screen.getByLabelText("开源仓库")).toHaveAttribute(
      "href",
      "https://github.com/zrbyhelp/zhaochunagerenlei",
    );
  });

  it("keeps admin focused on preferences without model configuration details", () => {
    renderWithMessages(<AdminShell />);

    expect(screen.getByText("返回对局")).toBeInTheDocument();
    expect(screen.getByText("界面设置")).toBeInTheDocument();
    expect(screen.queryByText("模型配置")).not.toBeInTheDocument();
    expect(screen.queryByText("OPENAI_API_KEY")).not.toBeInTheDocument();
    expect(screen.queryByText("OPENAI_MODEL")).not.toBeInTheDocument();
  });
});

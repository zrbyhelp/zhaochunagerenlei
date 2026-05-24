import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "谁是卧底之找出那个人类",
  description: "未来 AI 阵营中的两阶段推理网页游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Script src="/theme-runtime.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}

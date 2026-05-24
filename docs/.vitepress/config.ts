import { defineConfig } from "vitepress";

export default defineConfig({
  title: "谁是卧底之找出那个人类",
  description: "未来 AI 推理网页游戏文档",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "开发", link: "/development" },
    ],
    sidebar: [
      { text: "项目说明", link: "/" },
      { text: "开发说明", link: "/development" },
    ],
  },
});

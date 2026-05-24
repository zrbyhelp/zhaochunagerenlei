# 开发说明

## 命令

```bash
pnpm install
pnpm test
pnpm lint
pnpm run dev:app
pnpm docs:dev
```

测试不包含打包测试。只有在明确需要生产构建验证时才运行 `pnpm build`。

## 目录

- `src/app`：Next.js App Router 页面和 API。
- `src/components`：游戏界面、主题控件和基础 UI。
- `src/lib/game`：纯 TypeScript 游戏状态机。
- `src/lib/ai`：模型配置、提示词、schema、LangGraph 工作流。
- `src/messages`：中英文文案资源。
- `tests`：单元测试和组件测试。

## 国际化

默认语言为 `zh-CN`，可选 `en-US`。新增用户可见文案时，同步更新两个 JSON 资源文件。

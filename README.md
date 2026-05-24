# 谁是卧底之找出那个人类

作者：zr（中文名：臧浩然）

这是一个面向中文用户的网页推理游戏。背景设定为未来 AI 战胜人类后，残余人类混入 AI 社会；系统通过两阶段审查找出真正的人类。

## 功能范围

- 4-10 名成员开局，玩家名称由用户输入，AI 名称随机生成为真人感姓名，并带有稳定说话性格。
- 一阶段为“谁是卧底”：玩家和 AI 只知道自己的词语，不知道自身隐藏身份，系统内部随机发言、投票、淘汰。
- AI 发言和二阶段辩解自动生成，主界面以固定高度聊天记录展示公开内容，玩家只在自己的回合输入。
- 玩家一阶段胜利后进入二阶段。
- 二阶段会携带一阶段公开上下文，每个人都要解释自己为什么不是人类，并怀疑谁是人类，随后单轮投票。
- 如果玩家在二阶段不是最高票且不并列最高票，则游戏胜利。
- AI 仅通过 OpenAI-compatible 接口生成词语、发言、辩解和投票；词语会被约束为生活、工作、影视动漫人物等适合桌游的常见近义/同类词。
- AI 输出会保留结构化 JSON 校验和投票目标合法性校验，但不对正常文本长度、上下文引用数量做硬上限，避免模型稍微啰嗦就导致整局失败。
- 默认中文 `zh-CN`，支持英文 `en-US`。

## 环境变量

复制 `.env.example` 并填写：

```bash
PORT=3000
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_BASE_URL=
```

`OPENAI_BASE_URL` 可选，用于兼容 OpenAI API 格式的服务商。Langfuse 变量为可选观测配置。

## 开发命令

```bash
pnpm install
pnpm test
pnpm lint
pnpm run dev:app
pnpm docs:dev
```

`pnpm dev` 会同时启动应用和 VitePress 文档服务。默认验证只运行测试和静态检查，不把生产构建作为默认测试步骤。

## Docker 部署

先准备环境变量文件，至少包含：

```bash
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.5
OPENAI_BASE_URL=https://ai.zrbyhelp.com/v1
PORT=3000
```

然后运行：

```bash
docker compose up -d --build
```

服务默认暴露在 `http://localhost:${PORT}`，未设置时为 `http://localhost:3000`。镜像使用 Next.js standalone 输出，不会把 `.env.local` 打进镜像。

## 技术栈

- Next.js App Router、React、TypeScript
- Tailwind CSS、shadcn/ui 风格本地组件
- next-intl
- zod、@t3-oss/env-nextjs、react-hook-form
- openai SDK、LangGraph、Langfuse
- Vitest、React Testing Library
- VitePress

## License

本项目采用 MIT License。完整文本见 `LICENSE`。

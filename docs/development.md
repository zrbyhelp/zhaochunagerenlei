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

## Docker 部署

项目提供 `Dockerfile` 与 `docker-compose.yml`。部署前在服务器环境或 `.env` 文件中配置：

```bash
PORT=3000
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_BASE_URL=
```

启动命令：

```bash
docker compose up -d --build
```

容器端口和宿主机映射都通过 `PORT` 环境变量设置，未设置时默认 `3000`。镜像使用 Next.js standalone 输出，环境变量在容器运行时读取。

## 目录

- `src/app`：Next.js App Router 页面和 API。
- `src/components`：游戏界面、主题控件和基础 UI。
- `src/lib/game`：纯 TypeScript 游戏状态机。
- `src/lib/ai`：模型配置、提示词、schema、LangGraph 工作流。
- `src/messages`：中英文文案资源。
- `tests`：单元测试和组件测试。

## 国际化

默认语言为 `zh-CN`，可选 `en-US`。新增用户可见文案时，同步更新两个 JSON 资源文件。

## AI 表达与词语

AI 参与者由状态机分配真人感姓名和稳定 persona。模型提示词必须携带 persona，并要求输出像真实桌游玩家的口语表达，避免模板化报告。

玩家和 AI 都只看到自己的词语，不直接知道自身隐藏身份或完整词语对。AI 发言、投票和二阶段辩解只能根据公开发言、公开投票、出局记录和自己的词语谨慎推测。

AI 输出仍使用 zod 做结构化 JSON 校验：影响流程的字段必须存在，例如投票目标和怀疑对象；普通文本长度、二阶段上下文引用数量、非关键辅助说明不设置硬上限，避免 OpenAI-compatible 模型输出稍长或多带字段时直接失败。

词语生成仍由模型完成，但 prompt 限制为生活物品、食物饮品、办公/学习用品、交通工具、影视动漫人物等常见类别，普通词和卧底词必须同类且差距较小。

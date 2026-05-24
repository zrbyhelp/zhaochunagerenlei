# 谁是卧底之找出那个人类

欢迎来到项目文档。

## 首版目标

首版是单机完整游戏，不包含账号、数据库、Redis、对象存储或生产部署编排。玩家输入自己的名称，AI 玩家名称随机生成。

## 对局流程

1. 用户输入玩家名称并选择 4-10 名成员，AI 使用真人感姓名和固定说话性格。
2. 后端通过 OpenAI-compatible 模型生成适合“谁是卧底”的常见词语对。
3. 系统随机分配隐藏身份和说话顺序，玩家与 AI 只看到自己的词语。
4. 一阶段每名存活成员发言，AI 自动发言，玩家在自己的回合输入，然后投票淘汰。
5. 玩家一阶段失败则直接失败；玩家阵营胜利则进入二阶段。
6. 二阶段携带一阶段公开发言、投票和淘汰上下文，不暴露完整词语对或隐藏身份。
7. 每名存活成员解释自己为什么不是人类，并点名怀疑对象；AI 会按自身 persona 模拟真人语气辩解。
8. 单轮投票后，如果玩家不是最高票或并列最高票，则胜利。

## 模型配置

必填：

```bash
OPENAI_API_KEY=
OPENAI_MODEL=
```

可选：

```bash
OPENAI_BASE_URL=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASEURL=
```

缺少必填模型配置时，游戏不会使用本地模拟兜底，而是提示配置错误。

## Docker 部署

可以使用仓库内置的 `Dockerfile` 和 `docker-compose.yml` 部署：

```bash
docker compose up -d --build
```

运行前请通过服务器环境变量或 `.env` 文件提供 `OPENAI_API_KEY`、`OPENAI_MODEL`，以及可选的 `OPENAI_BASE_URL`。

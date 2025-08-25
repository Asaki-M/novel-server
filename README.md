# 小说聊天服务器

一个基于 OpenRouter + LangChain 的聊天服务，支持角色卡、会话记忆与函数调用（工具）。内置插画生成功能（Hugging Face Inference），默认开启工具调用。

## 功能特性

- 🤖 OpenRouter 聊天模型（默认使用 `qwen/qwen3-14b:free`）
- 🎭 角色卡系统：自定义 AI 角色与系统提示词
- 🧠 会话记忆：基于 Supabase 存储与摘要（仅文本对话参与摘要）
- 🧰 工具（Function Calling）：
  - `generate_illustration`：使用 Hugging Face Inference 生成插画
  - 默认启用工具；工具模式下仅支持非流式
  - 工具返回值为带前缀的 data URL（如 `data:image/png;base64,...`）
- 🌊 流式与非流式：
  - 纯对话支持流式
  - 工具模式不支持流式（将返回 400）
- 🔒 错误处理与参数校验（zod）

## 环境变量

在项目根目录创建 `.env`：

```env
# 服务端口
PORT=3008

# OpenRouter
OPENROUTER_API_KEY=你的_OpenRouter_API_密钥
OPENROUTER_MODEL=qwen/qwen3-14b:free
APP_REFERER=http://localhost:3000

# Supabase（用于会话记忆）
SUPABASE_URL=你的_Supabase_URL
SUPABASE_ANON_KEY=你的_Supabase_Anon_Key

# Hugging Face Inference（用于生成插画）
HF_TOKEN=你的_HF_TOKEN
```

说明：
- 工具调用默认启用；若要关闭需在请求体中显式传 `useTools: false`。
- 工具调用仅非流式；若传 `stream: true` 且 `useTools: true`，将返回 400。
- 会话记忆的摘要对图片结果不会参与；图片生成结果写库时以占位文本保存（避免后续摘要报错与膨胀）。

## 安装与启动

```bash
pnpm install

# 开发
pnpm run dev

# 或构建后启动
pnpm run build
pnpm start
```

服务默认在 `http://localhost:3008` 启动（可通过 `PORT` 修改）。

## API 概览

- 聊天：`POST /api/chat`
- 角色卡：
  - `GET    /api/characters` 列表
  - `POST   /api/characters` 创建
  - `GET    /api/characters/:characterId` 详情
  - `PUT    /api/characters/:characterId` 更新
  - `DELETE /api/characters/:characterId` 删除
- 健康检查：`GET /api/health/db`

详细字段见 `API.md`。

## 请求示例

### 1) 生成插画（默认启用工具，非流式）

```json
{
  "messages": [
    { "role": "user", "content": "帮我按照之前的剧情生成一张插画" }
  ],
  "allowedTools": ["generate_illustration"],
  "useMemory": true,
  "sessionId": "sess-123"
}
```

返回（核心字段）：

```json
{
  "success": true,
  "data": {
    "response": "data:image/png;base64,...."
  }
}
```

说明：
- 若模型未显式给出 `prompt`，服务会自动回填“最后一条用户消息”为工具参数。
- 返回为带前缀的 data URL，前端可直接赋值到 `<img src>`。

### 2) 普通对话（可流式，无工具）

```json
{
  "messages": [
    { "role": "user", "content": "继续刚才的剧情" }
  ],
  "useTools": false,
  "stream": true,
  "useMemory": true,
  "sessionId": "sess-123"
}
```

## 记忆与摘要说明

- 当 `useMemory=true` 且提供 `sessionId` 时，服务会读取该会话的历史消息并拼接上下文。
- 历史过长时会对文本对话做简要摘要，插入到系统消息中；图片生成结果不会参与摘要。
- 生成图片的结果写库时会保存占位文本（如 `[image_generated length=...]`），以避免未来摘要出错。

## 项目结构

```
novel-server/
├── src/
│   ├── config/
│   │   └── index.ts
│   ├── controllers/
│   │   └── chatController.ts
│   ├── routes/
│   │   └── *.ts
│   ├── services/
│   │   ├── langchainService.ts
│   │   └── characterService.ts
│   ├── tools/
│   │   └── index.ts               # 工具注册（Hugging Face 插画）
│   ├── types/
│   │   └── *.ts
│   └── index.ts
├── API.md
├── README.md
├── package.json
└── tsconfig.json
```

## 技术栈

- Node.js + TypeScript + Express
- LangChain（OpenRouter Chat）
- Supabase（会话历史）
- Hugging Face Inference（插画生成）

## 注意事项

- 工具模式不支持流式；若需要流式请关闭工具：`useTools=false`。
- 请勿把生成的 data URL 长文本写入日志。
- 生产环境请妥善保护环境变量（尤其是 `OPENROUTER_API_KEY` 与 `HF_TOKEN`）。

## 许可证

MIT License 
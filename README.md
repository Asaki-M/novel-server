# 小说聊天服务器

一个基于 OpenRouter + LangChain 的聊天服务，支持角色卡、会话记忆与 MCP Agent 智能路由。内置意图识别和插画生成功能。

## 功能特性

- 🤖 OpenRouter 聊天模型（默认使用 `qwen/qwen3-14b:free`）
- 🎭 角色卡系统：自定义 AI 角色与系统提示词
- 🧠 会话记忆：基于 Supabase 存储与摘要（仅文本对话参与摘要）
- 🤖 MCP Agent 智能路由：
  - 🧠 意图识别：自动判断用户是否需要生成图片
  - 🎨 文生图工具：使用 Hugging Face Inference 生成插画
  - 🔄 智能流式：检测到图片生成意图时自动切换为非流式响应
  - 📊 置信度控制：可配置意图识别的置信度阈值
- 🌊 双模式响应：
  - `/chat`：正常响应模式
  - `/chat/stream`：流式响应模式（支持智能切换）
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

# Supabase 数据库（用于会话记忆）
SUPABASE_URL=你的_Supabase_URL
SUPABASE_ANON_KEY=你的_Supabase_Anon_Key

# Supabase Storage S3 API（推荐用于图片存储）
SUPABASE_PROJECT_REF=你的_项目引用ID
SUPABASE_REGION=us-east-1
SUPABASE_S3_ACCESS_KEY_ID=你的_S3_访问密钥ID
SUPABASE_S3_SECRET_ACCESS_KEY=你的_S3_访问密钥

# Hugging Face Inference（用于生成插画）
HF_TOKEN=你的_HF_TOKEN
```

说明：
- 工具调用默认启用；若要关闭需在请求体中显式传 `useTools: false`。
- 工具调用仅非流式；若传 `stream: true` 且 `useTools: true`，将返回 400。
- 图片生成结果使用 **Supabase Storage S3 API** 上传，返回公开访问 URL。
- 会话记忆中直接存储图片 URL，支持历史图片查看。
- 清空会话记忆时会同时删除 Storage 中的相关图片。

### Supabase Storage S3 配置指南

1. 在 Supabase 项目设置中生成 S3 访问密钥：
   - 访问 `Project Settings > Storage > S3 Access Keys`
   - 点击 "Generate new keys" 生成新的访问密钥
   - 复制 Access Key ID 和 Secret Access Key

2. 配置环境变量：
   - `SUPABASE_PROJECT_REF`: 你的 Supabase 项目引用 ID
   - `SUPABASE_S3_ACCESS_KEY_ID`: S3 访问密钥 ID
   - `SUPABASE_S3_SECRET_ACCESS_KEY`: S3 访问密钥
   - `SUPABASE_REGION`: 默认为 `us-east-1`

3. 确保 Storage 桶 `text_to_image` 存在且设置为公开访问。

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

- 聊天：
  - `POST /api/chat` 正常响应模式
  - `POST /api/chat/stream` 流式响应模式（支持智能切换）
- 角色卡：
  - `GET    /api/characters` 列表
  - `POST   /api/characters` 创建
  - `GET    /api/characters/:characterId` 详情
  - `PUT    /api/characters/:characterId` 更新
  - `DELETE /api/characters/:characterId` 删除

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
    "response": "https://your-supabase-project.supabase.co/storage/v1/object/public/text_to_image/sessions/sess-123/1234567890-uuid.png"
  }
}
```

说明：
- 若模型未显式给出 `prompt`，服务会自动回填“最后一条用户消息”为工具参数。
- 返回的是 Supabase Storage 公开 URL，前端可直接访问。
- 图片限制为 512x512 像素高质量。

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
- 历史过长时会对文本对话做简要摘要，插入到系统消息中。
- 生成图片的结果会以 Supabase Storage URL 形式直接存储在会话历史中。
- 清空会话记忆时会同时删除 Supabase Storage 中的相关图片文件。

## 项目结构

```
novel-server/
├── src/
│   ├── agent/
│   │   └── mcpAgent.ts            # MCP Agent 智能路由
│   ├── config/
│   │   └── index.ts
│   ├── controllers/
│   │   └── chatController.ts
│   ├── mcp/
│   │   ├── server.ts              # MCP 服务器
│   │   └── tools/
│   │       ├── index.ts           # MCP 工具注册
│   │       ├── intentRecognition.ts  # 意图识别工具
│   │       └── generateIllustration.ts # 文生图工具
│   ├── routes/
│   │   └── *.ts
│   ├── services/
│   │   ├── langchainService.ts
│   │   └── characterService.ts
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
- 生成的图片存储在 Supabase Storage 中，请确保 Supabase 项目有足够的存储空间。
- 生产环境请妥善保护环境变量（尤其是 `OPENROUTER_API_KEY` 与 `HF_TOKEN`）。

## 许可证

MIT License 
# 聊天服务器 - 角色卡聊天系统

基于 OpenRouter Qwen3-14B 模型的简洁聊天接口服务器，支持角色卡功能。

## 功能特性

- 🤖 集成 OpenRouter 的 Qwen3-14B 免费模型
- 💬 支持对话聊天功能
- 🎭 角色卡系统 - 自定义AI角色和人格
- 🌊 支持流式和非流式响应
- 🔒 完整的错误处理和验证
- 📊 Token 使用统计
- 🌐 CORS 支持

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
OPENROUTER_API_KEY=你的_OpenRouter_API_密钥
SUPABASE_URL=你的_Supabase_URL
SUPABASE_ANON_KEY=你的_Supabase_Anon_Key
PORT=3000
```

> 📝 在 OpenRouter Keys 页面获取 API 密钥，在 Supabase 项目设置中获取 URL 与 Anon Key。

### 3. 构建和启动服务器

```bash
# 开发模式
pnpm run dev

# 或者分步执行
pnpm run build
pnpm start
```

服务器将在 `http://localhost:3000` 启动（或 `.env` 中设置的端口）。

## 📚 API 文档

详见单独的文档：`API.md`

- 聊天接口：`POST /api/chat`
- 角色卡管理：`/api/characters`（列表/详情/创建/更新/删除）
- 健康检查：`GET /api/health/db`

## 🛠️ 项目结构

```
novel-server/
├── src/
│   ├── config/
│   │   └── index.ts
│   ├── controllers/
│   │   ├── chatController.ts
│   │   ├── healthController.ts
│   ├── middlewares/
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── chatRoutes.ts
│   │   ├── healthRoutes.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── characterService.ts
│   │   ├── langchainService.ts
│   ├── types/
│   │   ├── character.ts
│   │   └── chat.ts
│   └── index.ts
├── API.md
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ 技术栈

- 运行时: Node.js + TypeScript
- 框架: Express.js
- AI: OpenRouter Qwen3-14B
- 数据: Supabase (Postgres)
- 包管理: pnpm
- 架构: MVC（Controller → Service → External API）

## 许可证

MIT License 
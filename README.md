# Novel Chat Server

基于 OpenRouter + LangChain + MCP 的智能聊天服务器，采用 ReAct 模式实现工具调用和推理能力。支持角色卡系统、会话记忆管理和流式响应。

## 核心特性

- 🤖 **ReAct Agent 架构**：基于 Reasoning + Acting 模式的智能代理
- 🔧 **MCP 工具集成**：Model Context Protocol 工具调用框架
- 🎭 **角色卡系统**：自定义 AI 角色与系统提示词
- 🧠 **会话记忆**：基于 Supabase 的持久化对话历史
- 🌊 **双模式响应**：支持普通响应和 Server-Sent Events 流式响应
- 📊 **Token 统计**：完整的 API 使用量监控
- 🔒 **类型安全**：完整的 TypeScript 类型定义和参数校验

## 架构概览

### ReAct Agent 工作流程

```
用户输入 → Agent → ReAct 循环 → 工具调用 → 最终答案
                    ↓
            [思考] → [行动] → [观察] → [思考] → ...
```

## 环境配置

创建 `.env` 文件：

```env
# 服务配置
PORT=3008
APP_REFERER=http://localhost:3000

# OpenRouter LLM
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=qwen/qwq-32b:free

# Supabase 数据库
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Storage (可选，用于图片存储)
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_REGION=us-east-1
SUPABASE_S3_ACCESS_KEY_ID=your_s3_access_key
SUPABASE_S3_SECRET_ACCESS_KEY=your_s3_secret_key

# Hugging Face (可选，用于图片生成工具)
HF_TOKEN=your_hf_token
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
# 开发模式（自动重启）
pnpm run dev

# 生产模式
pnpm run build
pnpm start
```

服务将在 `http://localhost:3008` 启动。

### MCP 服务器（可选）

如果需要工具调用功能，可以启动独立的 MCP 服务器：

```bash
# 开发模式
pnpm run mcp:dev

# 生产模式
pnpm run mcp
```

## API 接口

详细 API 文档请参考 [`API.md`](./API.md)。

## ReAct 工作原理

Agent 采用 **Reasoning + Acting** 模式：

1. **Thought（思考）**：分析用户需求，制定行动计划
2. **Action（行动）**：调用相应的工具或给出最终答案
3. **Observation（观察）**：接收工具执行结果
4. **循环**：重复上述过程直到得出最终答案

这种模式让 AI 能够：
- 🧠 进行多步推理
- 🔧 动态调用外部工具
- 🔄 根据结果调整策略
- 📝 提供完整的思考过程

## 项目结构

```
novel-server/
├── src/
│   ├── agent/                    # ReAct Agent 核心
│   │   ├── agent.ts             # Agent 主类
│   │   ├── prompt/              # ReAct 提示词
│   │   ├── mcp/                 # MCP 客户端管理
│   │   └── llm/                 # LLM 配置
│   ├── controllers/             # HTTP 控制器
│   │   ├── agentChatController.ts
│   │   ├── characterController.ts
│   │   └── memoryController.ts
│   ├── services/                # 业务服务层
│   │   ├── supabaseService.ts
│   │   ├── characterService.ts
│   │   └── imageStorageService.ts
│   ├── routes/                  # 路由定义
│   ├── types/                   # TypeScript 类型
│   ├── config/                  # 配置管理
│   └── utils/                   # 工具函数
├── API.md                       # API 文档
└── README.md                    # 项目说明
```

## 技术栈

- **后端框架**：Node.js + TypeScript + Express
- **AI 框架**：LangChain + OpenRouter
- **Agent 架构**：ReAct (Reasoning + Acting)
- **工具协议**：MCP (Model Context Protocol)
- **数据库**：Supabase (PostgreSQL)
- **类型系统**：完整的 TypeScript 类型定义

## 开发指南

### 添加新工具

1. 创建 MCP 服务器实现工具逻辑
2. 在 `src/agent/index.ts` 中注册 MCP 服务器
3. Agent 会自动发现并集成新工具

### 自定义角色

通过角色卡 API 创建具有特定人格和行为的 AI 角色：

```json
{
  "name": "小说助手",
  "description": "专业的小说创作助手",
  "systemPrompt": "你是一个专业的小说创作助手，擅长情节构思和人物塑造..."
}
```

### 会话记忆

系统自动管理对话历史，支持：
- 长期记忆存储
- 智能摘要压缩
- 上下文相关性保持

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t novel-chat-server .

# 运行容器
docker run -p 3008:3008 --env-file .env novel-chat-server
```

### Vercel 部署

项目支持 Vercel Serverless 部署，自动检测运行环境。

## 许可证

MIT License

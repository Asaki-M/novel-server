# 聊天服务器 - 角色卡聊天系统

基于 OpenRouter Qwen3-14B 模型的简洁聊天接口服务器，支持角色卡功能。

## 功能特性

- 🤖 集成 OpenRouter 的 Qwen3-14B 免费模型
- 💬 支持对话聊天功能
- 🎭 **角色卡系统** - 自定义AI角色和人格
- 🌊 支持流式和非流式响应
- 🔒 完整的错误处理和验证
- 📊 Token 使用统计
- 🌐 CORS 支持
- 🔍 健康检查接口

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
OPENROUTER_API_KEY=你的_OpenRouter_API_密钥
PORT=3000
```

> 📝 在 [OpenRouter Keys](https://openrouter.ai/keys) 页面获取你的 API 密钥

### 3. 构建和启动服务器

```bash
# 开发模式
pnpm run dev

# 或者分步执行
pnpm run build
pnpm start
```

服务器将在 `http://localhost:3000` 启动。

## 📚 API 接口文档

### 1. 聊天接口

发送消息给 AI 模型进行对话。

**请求信息**
- **方法**: `POST`
- **路径**: `/api/chat`
- **Content-Type**: `application/json`

**请求参数**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `messages` | `Array<ChatMessage>` | ✅ | - | 对话消息列表 |
| `characterId` | `string` | ❌ | - | 🎭 **角色卡ID** |
| `temperature` | `number` | ❌ | `0.7` | 控制回复的随机性 (0-2) |
| `max_tokens` | `number` | ❌ | `2048` | 最大输出token数 |
| `stream` | `boolean` | ❌ | `false` | 是否启用流式响应 |

**ChatMessage 结构**

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | `'user' \| 'assistant' \| 'system'` | 消息角色 |
| `content` | `string` | 消息内容 |

**请求示例**

**普通聊天**：
```json
{
  "messages": [
    {
      "role": "user",
      "content": "你好！"
    }
  ],
  "temperature": 0.7
}
```

**使用角色卡聊天**：
```json
{
  "messages": [
    {
      "role": "user",
      "content": "帮我写一个霸道总裁的剧情"
    }
  ],
  "characterId": "character_uuid",
  "temperature": 0.8
}
```

**响应格式**

```json
{
  "success": true,
  "message": "霸道总裁 回复成功",
  "data": {
    "response": "既然你这么说，那我就勉为其难地帮你一次...",
    "character": {
      "id": "character_uuid",
      "name": "霸道总裁",
      "avatar": "💼",
      "category": "roleplay"
    },
    "usage": {
      "prompt_tokens": 25,
      "completion_tokens": 156,
      "total_tokens": 181
    }
  }
}
```

**响应格式 (流式模式)**

当 `stream: true` 时，返回 Server-Sent Events 流：

```
Content-Type: text/event-stream

data: {"content": "在"}
data: {"content": "2087"}
data: {"content": "年的"}
data: {"content": "新东京"}
...
data: [DONE]
```

### 2. 健康检查接口

检查服务器运行状态。

**请求信息**
- **方法**: `GET`
- **路径**: `/health`

**响应示例**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-12-19T10:30:00.000Z",
    "uptime": 3600.25,
    "memory": {
      "rss": 45678592,
      "heapTotal": 29425664,
      "heapUsed": 18956032,
      "external": 2134567,
      "arrayBuffers": 123456
    }
  }
}
```

### 3. 角色卡管理接口

#### 获取角色卡列表

**GET** `/api/characters`

**查询参数**:
- `category`: 分类筛选 (`novel`/`roleplay`/`assistant`/`custom`)
- `tags`: 标签筛选 (多个用逗号分隔)
- `keyword`: 关键词搜索
- `page`: 页码 (默认1)
- `limit`: 每页数量 (默认20)
- `sortBy`: 排序方式 (`popular`/`newest`/`rating`/`name`)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "characters": [
      {
        "id": "uuid",
        "name": "霸道总裁",
        "avatar": "💼",
        "description": "高冷霸道的总裁角色",
        "personality": ["霸道", "深情", "高冷"],
        "tags": ["总裁", "言情", "霸道"],
        "category": "roleplay",
        "isBuiltIn": true,
        "usageCount": 1250,
        "rating": 4.8
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20
  }
}
```

#### 创建角色卡

**POST** `/api/characters`

**请求参数**:
```json
{
  "name": "我的自定义角色",
  "avatar": "😊",
  "description": "一个温柔可爱的角色",
  "systemPrompt": "你是一个温柔可爱的助手，说话温和亲切...",
  "personality": ["温柔", "可爱", "善良"],
  "tags": ["温柔", "助手", "可爱"],
  "category": "custom",
  "isPublic": false,
  "examples": [
    {
      "user": "你好",
      "assistant": "你好呀～很高兴见到你！"
    }
  ]
}
```

#### 其他角色卡接口

- **GET** `/api/characters/:id` - 获取角色卡详情
- **PUT** `/api/characters/:id` - 更新角色卡
- **DELETE** `/api/characters/:id` - 删除角色卡
- **GET** `/api/characters/stats` - 获取统计信息

### 4. 模型列表接口

**GET** `/api/models` - 获取可用的 AI 模型列表

### 5. 错误响应

所有接口在出错时都返回统一的错误格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

**常见错误码**

| HTTP状态码 | 错误类型 | 说明 |
|-----------|----------|------|
| `400` | 请求参数错误 | 缺少必填参数或参数格式不正确 |
| `401` | 认证失败 | API密钥无效或已过期 |
| `404` | 路径不存在 | 请求的API路径不存在 |
| `429` | 请求频率限制 | 请求过于频繁，需要稍后重试 |
| `500` | 服务器错误 | 内部服务器错误 |

## 🧪 测试

我们提供了API测试脚本来验证接口功能：

```bash
# 启动服务器
pnpm run dev

# 在新终端窗口运行测试
pnpm test
```

**测试内容包括：**
- ✅ 健康检查接口
- ✅ 模型列表接口  
- ✅ 聊天接口 (正常流程)
- ✅ 错误处理机制

## 🎭 角色卡系统使用指南

### 内置角色

系统提供了4个精心设计的内置角色：

| 角色 | 描述 | 适用场景 |
|------|------|----------|
| 📚 小说创作助手 | 专业的文学创作助手 | 小说创作、剧情构思 |
| 💼 霸道总裁 | 高冷霸道的言情角色 | 都市言情、角色扮演 |
| 🎋 古风才子 | 温文尔雅的古代书生 | 古风小说、诗词创作 |
| 🤖 智能助手 | 通用智能助手 | 问答、日常对话 |

### 快速开始

**1. 获取角色列表**
```bash
curl http://localhost:3000/api/characters
```

**2. 与霸道总裁聊天**
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: '今天工作累吗？' }
    ],
    characterId: 'character_uuid' // 霸道总裁的ID
  })
});
```

**3. 创建自定义角色**
```javascript
const character = await fetch('/api/characters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '温柔学姐',
    avatar: '🌸',
    description: '温柔体贴的学姐角色',
    systemPrompt: '你是一位温柔体贴的学姐，说话轻声细语，总是关心他人...',
    personality: ['温柔', '体贴', '善良'],
    tags: ['学姐', '温柔', '校园'],
    category: 'roleplay'
  })
});
```

## 使用示例

### JavaScript/Node.js

**基础聊天**：
```javascript
async function chat(message) {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }]
    })
  });
  
  const data = await response.json();
  return data.data.response;
}
```

**角色扮演聊天**：
```javascript
async function roleplayChat(message, characterId) {
  const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      characterId: characterId,
      temperature: 0.8 // 更有创意的回复
    })
  });
  
  const data = await response.json();
  return {
    response: data.data.response,
    character: data.data.character
  };
}

// 使用
roleplayChat('帮我处理这个项目', 'domineering_ceo_id').then(result => {
  console.log(`${result.character.name}: ${result.response}`);
});
```

### cURL

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好！"}
    ]
  }'
```

## 流式响应

设置 `"stream": true` 来启用流式响应：

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '讲个故事' }],
    stream: true
  })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = new TextDecoder().decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(data);
        process.stdout.write(parsed.content);
      } catch (e) {}
    }
  }
}
```

## 错误处理

接口包含完整的错误处理：

- `400` - 请求参数错误
- `401` - API 密钥无效
- `429` - 请求频率限制
- `500` - 服务器内部错误

## 🏗️ 项目结构

```
novel-server/
├── src/
│   ├── config/           # 配置文件
│   │   └── index.ts      # 应用配置
│   ├── controllers/      # 控制器层
│   │   ├── chatController.ts
│   │   └── healthController.ts
│   ├── middlewares/      # 中间件
│   │   ├── cors.ts
│   │   └── errorHandler.ts
│   ├── routes/          # 路由层
│   │   ├── chatRoutes.ts
│   │   ├── healthRoutes.ts
│   │   └── index.ts
│   ├── services/        # 服务层
│   │   ├── characterService.ts
│   │   └── openaiService.ts
│   ├── types/           # 类型定义
│   │   ├── character.ts
│   │   └── chat.ts
│   └── index.ts         # 应用入口
├── scripts/             # 工具脚本
│   └── test-api.js      # API测试脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ 技术栈

- **运行时**: Node.js + TypeScript
- **框架**: Express.js
- **AI 模型**: OpenRouter Qwen3-14B (免费)
- **包管理**: pnpm
- **架构模式**: MVC (Model-View-Controller)
- **代码组织**: 分层架构 (Controller → Service → External API)

## 许可证

MIT License 
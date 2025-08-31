# Novel Server API 文档

本文档描述 novel-server 的 HTTP API 接口，包含聊天、角色卡管理、记忆管理和智能代理功能。

## 基础信息

- **基础路径**: `http://localhost:3008`
- **数据格式**: 所有 API 均返回 JSON
- **跨域支持**: CORS 已开启
- **编码**: UTF-8

## 环境配置

服务器需要以下环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API 密钥，用于 LLM 对话 | ✅ |
| `SUPABASE_URL` | Supabase 项目 URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | ✅ |
| `HF_TOKEN` | HuggingFace API Token，用于图片生成 | ✅ |

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功描述（可选）",
  "data": {} // 具体数据
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP 状态码
- `200` - 请求成功
- `201` - 创建成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 1. 聊天接口

### 1.1 普通聊天

**接口**: `POST /api/chat`

**描述**: 发起普通聊天对话，支持角色卡和会话记忆

**请求头**:
```
Content-Type: application/json
```

**请求参数**:
```json
{
  "messages": [
    { "role": "user", "content": "你好！" }
  ],
  "characterId": "character-uuid",
  "sessionId": "session-uuid",
  "temperature": 0.7,
  "max_tokens": 1024
}
```

**参数说明**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `messages` | Array | ✅ | 对话消息数组 |
| `characterId` | String | ✅ | 角色卡ID |
| `sessionId` | String | ✅ | 会话ID，用于记忆功能 |
| `temperature` | Number | ❌ | 温度参数，默认0.7 |
| `max_tokens` | Number | ❌ | 最大token数 |

**消息格式**:
```json
{
  "role": "user|assistant|system",
  "content": "消息内容"
}
```

**成功响应**:
```json
{
  "success": true,
  "message": "AI助手的回复内容"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 1.2 流式聊天

**接口**: `POST /api/chat/stream`

**描述**: 发起流式聊天对话，实时返回AI回复

**请求参数**: 与普通聊天相同

**响应格式**: `text/event-stream`
```
data: {"content":"你"}

data: {"content":"好"}

data: {"content":"！"}

data: [DONE]
```

**JavaScript 示例**:
```javascript
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '你好' }],
    characterId: 'character-id',
    sessionId: 'session-id'
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
        console.log(parsed.content);
      } catch (e) {}
    }
  }
}
```

---

## 2. 角色卡管理接口

### 2.1 获取角色卡列表

**接口**: `GET /api/characters`

**描述**: 获取所有角色卡列表

**请求参数**: 无

**成功响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "character-uuid",
      "name": "角色名称",
      "description": "角色描述",
      "systemPrompt": "系统提示词",
      "avatar": "头像URL",
      "isBuiltIn": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2.2 获取角色卡详情

**接口**: `GET /api/characters/:characterId`

**描述**: 获取指定角色卡的详细信息

**路径参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `characterId` | String | ✅ | 角色卡ID |

**成功响应**:
```json
{
  "success": true,
  "data": {
    "id": "character-uuid",
    "name": "角色名称",
    "description": "角色描述",
    "systemPrompt": "系统提示词",
    "avatar": "头像URL",
    "isBuiltIn": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "角色卡不存在"
}
```

### 2.3 创建角色卡

**接口**: `POST /api/characters`

**描述**: 创建新的角色卡

**请求参数**:
```json
{
  "name": "角色名称",
  "description": "角色描述",
  "systemPrompt": "系统提示词",
  "avatar": "头像URL（可选）"
}
```

**参数说明**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | String | ✅ | 角色名称 |
| `description` | String | ✅ | 角色描述 |
| `systemPrompt` | String | ✅ | 系统提示词 |
| `avatar` | String | ❌ | 头像URL |

**成功响应**:
```json
{
  "success": true,
  "message": "角色卡创建成功",
  "data": {
    "id": "character-uuid",
    "name": "角色名称",
    "description": "角色描述",
    "systemPrompt": "系统提示词",
    "avatar": "头像URL",
    "isBuiltIn": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2.4 更新角色卡

**接口**: `PUT /api/characters/:characterId`

**描述**: 更新指定角色卡的信息

**路径参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `characterId` | String | ✅ | 角色卡ID |

**请求参数**:
```json
{
  "name": "新的角色名称",
  "description": "新的角色描述",
  "systemPrompt": "新的系统提示词",
  "avatar": "新的头像URL"
}
```

**参数说明**: 所有参数都是可选的，只更新提供的字段

**成功响应**:
```json
{
  "success": true,
  "message": "角色卡更新成功",
  "data": {
    "id": "character-uuid",
    "name": "新的角色名称",
    "description": "新的角色描述",
    "systemPrompt": "新的系统提示词",
    "avatar": "新的头像URL",
    "isBuiltIn": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2.5 删除角色卡

**接口**: `DELETE /api/characters/:characterId`

**描述**: 删除指定的角色卡

**路径参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `characterId` | String | ✅ | 角色卡ID |

**成功响应**:
```json
{
  "success": true,
  "message": "角色卡删除成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "角色卡不存在或无法删除内置角色"
}
```

---

## 3. 记忆管理接口

### 3.1 获取会话记忆

**接口**: `GET /api/memory/:sessionId`

**描述**: 获取指定会话的聊天记录

**路径参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `sessionId` | String | ✅ | 会话ID |

**成功响应**:
```json
{
  "success": true,
  "data": [
    {
      "role": "user",
      "content": "你好",
      "created_at": "2024-01-01T12:00:00Z"
    },
    {
      "role": "assistant",
      "content": "你好！有什么可以帮助你的吗？",
      "created_at": "2024-01-01T12:00:02Z"
    }
  ]
}
```

### 3.2 清空会话记忆

**接口**: `DELETE /api/memory/:sessionId`

**描述**: 清空指定会话的聊天记录和相关图片

**路径参数**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `sessionId` | String | ✅ | 会话ID |

**成功响应**:
```json
{
  "success": true,
  "message": "已清空会话记忆",
  "data": {
    "deleted": 6
  }
}
```

---

## 4. 智能代理接口

### 4.1 代理聊天

**接口**: `POST /api/agent/chat`

**描述**: 使用智能代理进行聊天，支持意图识别和图片生成

**请求参数**:
```json
{
  "messages": [
    { "role": "user", "content": "帮我生成一张古风美女的图片" }
  ],
  "characterId": "character-uuid",
  "sessionId": "session-uuid",
  "verbose": true
}
```

**参数说明**:
| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `messages` | Array | ✅ | 对话消息数组 |
| `characterId` | String | ✅ | 角色卡ID |
| `sessionId` | String | ✅ | 会话ID |
| `verbose` | Boolean | ❌ | 是否返回详细调试信息 |

**成功响应（普通聊天）**:
```json
{
  "success": true,
  "message": "AI助手的回复内容",
  "debug": {
    "toolsUsed": ["normal_chat"],
    "intermediateSteps": [
      {
        "action": "normal_chat",
        "result": "聊天结果"
      }
    ]
  }
}
```

**成功响应（图片生成）**:
```json
{
  "success": true,
  "message": "我已经为您生成了一张图片！\n\n🖼️ 图片链接：https://qzscuzndpxdygetaacsf.supabase.co/storage/v1/object/public/text_to_image/sessions/session-uuid/1234567890-uuid.png\n📝 生成提示词：帮我生成一张古风美女的图片",
  "debug": {
    "toolsUsed": ["generate_illustration_direct"],
    "intermediateSteps": [
      {
        "action": "generate_illustration_direct",
        "result": {
          "url": "https://qzscuzndpxdygetaacsf.supabase.co/storage/v1/object/public/text_to_image/sessions/session-uuid/1234567890-uuid.png",
          "prompt": "帮我生成一张古风美女的图片",
          "timestamp": 1234567890
        }
      }
    ]
  }
}
```

### 4.2 代理流式聊天

**接口**: `POST /api/agent/chat/stream`

**描述**: 使用智能代理进行流式聊天

**请求参数**: 与代理聊天相同

**响应格式**: `text/event-stream`
```
🧠 正在分析您的请求...

🎯 意图识别: 图片生成 (置信度: 0.85)

🎨 正在生成图片，请稍候...

我已经为您生成了一张图片！

🖼️ 图片链接：https://...
```

---

## 5. 使用示例

### 5.1 基础聊天示例

```bash
curl -X POST http://localhost:3008/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好"}],
    "characterId": "character-uuid",
    "sessionId": "session-uuid"
  }'
```

### 5.2 创建角色卡示例

```bash
curl -X POST http://localhost:3008/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "温柔学姐",
    "description": "温柔体贴的学姐角色",
    "systemPrompt": "你是一位温柔体贴的学姐，总是用关怀的语气与人交流。"
  }'
```

### 5.3 智能代理图片生成示例

```bash
curl -X POST http://localhost:3008/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "生成一张古风美女图片"}],
    "characterId": "character-uuid",
    "sessionId": "session-uuid",
    "verbose": true
  }'
```

### 5.4 JavaScript 流式聊天示例

```javascript
async function streamChat() {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '讲个故事' }],
      characterId: 'character-uuid',
      sessionId: 'session-uuid'
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          console.log(parsed.content);
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}
```

---

## 6. 错误处理

### 常见错误码

| 状态码 | 说明 | 示例 |
|--------|------|------|
| 400 | 请求参数错误 | 缺少必需参数 |
| 404 | 资源不存在 | 角色卡不存在 |
| 500 | 服务器内部错误 | 数据库连接失败 |

### 错误响应格式

```json
{
  "success": false,
  "error": "具体的错误描述信息"
}
```

### 常见错误信息

- `"请提供有效的消息数组"` - messages 参数格式错误
- `"sessionId 是必需的"` - 缺少 sessionId 参数
- `"characterId 是必需的"` - 缺少 characterId 参数
- `"角色卡不存在"` - 指定的角色卡ID不存在
- `"角色名称、描述和系统提示词为必填项"` - 创建角色卡时缺少必需字段
- `"图片生成服务暂时不可用"` - HuggingFace API 调用失败

---

## 7. 注意事项

1. **会话管理**: 每个会话需要唯一的 `sessionId`，用于记忆功能
2. **角色卡**: 每次聊天都需要指定 `characterId`，系统会自动注入对应的系统提示词
3. **图片生成**: 使用 HuggingFace 的 `Jonjew/NSFWHanfu` 模型，生成的图片会自动上传到 Supabase Storage
4. **流式响应**: 流式接口返回 `text/event-stream` 格式，需要正确解析 SSE 数据
5. **错误处理**: 所有接口都遵循统一的错误响应格式，便于客户端处理

---

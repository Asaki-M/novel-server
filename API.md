# API 文档

本文档描述 novel-server 的 HTTP API，与当前代码实现保持一致。

- 基础路径：`/`
- 所有 API 均返回 JSON
- CORS 已开启

## 认证与环境

- 使用 OpenRouter 进行对话，需要环境变量：`OPENROUTER_API_KEY`
- 使用 Supabase 存储带记忆聊天与角色卡，需要环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`
- 使用 Hugging Face 生成插画，需要环境变量：`HF_TOKEN`

---

## 健康检查

### GET `/api/health/db`
检查 Supabase 数据库连通性。

- 响应示例（成功）：
```json
{ "ok": true, "latencyMs": 45, "sampleCount": 0 }
```
- 响应示例（失败）：
```json
{ "ok": false, "latencyMs": 12, "error": "..." }
```

---

## 聊天接口

### POST `/api/chat`
向大模型发起聊天/工具调用。

- 请求头：`Content-Type: application/json`
- 请求体：
```json
{
  "messages": [
    { "role": "user", "content": "你好！" }
  ],
  "characterId": "optional-character-id",
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false,
  "useTools": true,
  "allowedTools": ["generate_illustration"],
  "useMemory": true,
  "sessionId": "sess-123"
}
```
- 字段说明：
  - `messages` 必填：对话消息数组，元素为 `{ role: 'user'|'assistant'|'system', content: string }`
  - `characterId` 选填：角色卡 ID；提供后会注入其 `systemPrompt`
  - `temperature` 选填：默认 0.7
  - `max_tokens` 选填
  - `stream` 选填：是否使用 SSE 流式；当 `useTools: true` 时禁止流式
  - `useTools` 选填：是否启用工具调用，默认启用（未传视为 `true`）
  - `allowedTools` 选填：工具白名单；不传表示允许内置全部工具
  - `useMemory` 选填：是否启用会话记忆
  - `sessionId` 选填：记忆模式下的会话 ID（必填）

- 行为说明：
  - 工具模式不支持流式（若 `stream: true` 且 `useTools: true` 会返回 400）
  - 工具参数若未提供 `prompt`，将自动回填为“最后一条用户消息”
  - 插画生成返回为带前缀的 data URL（`data:image/png;base64,...`）
  - 记忆存储时，图片结果以占位文本写入，避免后续摘要出错

- 响应（非流式）示例：
```json
{
  "success": true,
  "message": "聊天响应成功(工具)",
  "data": {
    "response": "data:image/png;base64,....",
    "character": { "id": "...", "name": "...", "category": "custom" }
  }
}
```

#### 流式模式（SSE）
当 `stream: true` 且未启用工具时，返回 `text/event-stream`：
```
data: {"content":"在"}

data: {"content":"2087"}
...

data: [DONE]
```

---

## 角色卡接口

角色卡与数据库表 `characters` 对应，字段：
- `id: string`
- `name: string`
- `avatar?: string | null`
- `description: string`
- `system_prompt: string`
- `created_at: timestamptz`
- `updated_at: timestamptz`

### GET `/api/characters`
返回角色卡列表（按 `created_at` 倒序）。

- 响应示例：
```json
{ "success": true, "data": [ { "id": "...", "name": "...", "description": "...", "systemPrompt": "..." } ] }
```

### GET `/api/characters/:characterId`
返回某个角色卡详情。

### POST `/api/characters`
创建角色卡。

- 请求体：
```json
{
  "name": "温柔学姐",
  "avatar": "🌸",
  "description": "温柔体贴的学姐角色",
  "systemPrompt": "你是一位温柔体贴的学姐..."
}
```

### PUT `/api/characters/:characterId`
更新角色卡任意字段（`name`/`avatar`/`description`/`systemPrompt`）。

### DELETE `/api/characters/:characterId`
删除角色卡。

---

## 错误响应

所有接口在出错时返回统一格式：
```json
{ "success": false, "error": "错误描述" }
```

常见状态码：
- 400 参数错误（例如：`useTools=true` 且 `stream=true`）
- 401 认证失败（OpenRouter key 失效）
- 404 路径不存在
- 429 请求过多
- 500 服务器内部错误

---

## 示例

### cURL（生成插画）
```bash
curl -X POST http://localhost:3008/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "帮我按照之前的剧情生成一张插画"}],
    "allowedTools": ["generate_illustration"],
    "useMemory": true,
    "sessionId": "sess-123"
  }'
```

### JavaScript（非流式 + 工具）
```javascript
const res = await fetch('http://localhost:3008/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '帮我按照之前的剧情生成一张插画' }],
    allowedTools: ['generate_illustration'],
    useMemory: true,
    sessionId: 'sess-123'
  })
});
const data = await res.json();
const imgSrc = data.data.response; // data:image/png;base64,...
```

### JavaScript（流式，无工具）
```javascript
const res = await fetch('http://localhost:3008/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: '讲个故事' }], stream: true, useTools: false })
});
const reader = res.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = new TextDecoder().decode(value);
  for (const line of chunk.split('\n')) {
    if (line.startsWith('data: ')) {
      const payload = line.slice(6);
      if (payload === '[DONE]') break;
      try { console.log(JSON.parse(payload).content); } catch {}
    }
  }
}
``` 
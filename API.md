# Novel Server API 接口

## 1. Agent 聊天

**POST** `/api/agent/chat`

**请求体:**
```json
{
  "sessionId": "string",
  "characterId": "string",
  "message": "string"
}
```

**响应体:**
```json
{
  "message": "string"
}
```

## 2. 角色卡管理

### 获取角色卡列表
**GET** `/api/characters`

**响应体:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "avatar": "string",
      "description": "string",
      "systemPrompt": "string",
      "backstoryPrompt": "string",
      "backstory": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

### 获取角色卡详情
**GET** `/api/characters/:characterId`

**响应体:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "avatar": "string",
    "description": "string",
    "systemPrompt": "string",
    "backstoryPrompt": "string",
    "backstory": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

### 创建角色卡
**POST** `/api/characters`

**请求体:**
```json
{
  "name": "string",
  "description": "string",
  "systemPrompt": "string",
  "avatar": "string",
  "backstoryPrompt": "string",
  "backstory": "string"
}
```

**响应体:**
```json
{
  "success": true,
  "message": "角色卡创建成功",
  "data": {
    "id": "string",
    "name": "string",
    "avatar": "string",
    "description": "string",
    "systemPrompt": "string",
    "backstoryPrompt": "string",
    "backstory": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

### 更新角色卡
**PUT** `/api/characters/:characterId`

**请求体:**
```json
{
  "name": "string",
  "avatar": "string",
  "description": "string",
  "systemPrompt": "string",
  "backstoryPrompt": "string",
  "backstory": "string"
}
```

**响应体:**
```json
{
  "success": true,
  "message": "角色卡更新成功",
  "data": {
    "id": "string",
    "name": "string",
    "avatar": "string",
    "description": "string",
    "systemPrompt": "string",
    "backstoryPrompt": "string",
    "backstory": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
}
```

### 删除角色卡
**DELETE** `/api/characters/:characterId`

**响应体:**
```json
{
  "success": true,
  "message": "角色卡删除成功"
}
```

## 3. 记忆管理

### 获取会话记忆
**GET** `/api/memory/:sessionId`

**响应体:**
```json
{
  "success": true,
  "data": [
    {
      "role": "string",
      "content": "string",
      "created_at": "string"
    }
  ]
}
```

### 清空会话记忆
**DELETE** `/api/memory/:sessionId`

**响应体:**
```json
{
  "success": true,
  "message": "已清空会话记忆",
  "data": {
    "deleted": 0
  }
}
```

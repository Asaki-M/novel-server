# 标准 MCP 服务器

这是一个符合 Model Context Protocol (MCP) 标准的服务器实现，提供意图识别和文生图功能。

## 功能

### 工具列表

1. **intent_recognition** - 意图识别
   - 分析用户消息，判断是否需要生成图片
   - 输入：`message` (必填), `context` (可选)
   - 输出：意图类型、置信度、推理过程

2. **generate_illustration** - 文生图
   - 根据文本描述生成插画图片
   - 输入：`prompt` (必填), `sessionId` (必填), `style` (默认: anime), `size` (默认: 512x512), `quality` (默认: high)
   - 输出：图片 URL 或 base64 数据

## 使用方法

### 开发模式启动
```bash
pnpm mcp:dev
```

### 生产模式启动
```bash
pnpm build
pnpm mcp
```

## MCP 客户端集成

### Claude Desktop 配置

在 Claude Desktop 的配置文件中添加：

```json
{
  "mcpServers": {
    "novel-server": {
      "command": "node",
      "args": ["path/to/novel-server/dist/mcp/index.js"],
      "env": {
        "HF_TOKEN": "your_huggingface_token"
      }
    }
  }
}
```

### 环境变量

确保设置以下环境变量：
- `HF_TOKEN`: Hugging Face API Token（用于文生图）
- 其他数据库连接配置

## 工具调用示例

### 意图识别
```json
{
  "name": "intent_recognition",
  "arguments": {
    "message": "帮我画一张夕阳下的城市风景",
    "context": [
      {"role": "user", "content": "你好"},
      {"role": "assistant", "content": "你好！有什么可以帮助你的吗？"}
    ]
  }
}
```

### 文生图
```json
{
  "name": "generate_illustration", 
  "arguments": {
    "prompt": "夕阳下的城市风景",
    "sessionId": "session_123",
    "style": "anime",
    "size": "768x768",
    "quality": "high"
  }
}
```

## 技术栈

- **MCP SDK**: @modelcontextprotocol/sdk
- **AI 模型**: Hugging Face FLUX.1-schnell
- **语言模型**: 通过 LangChain 集成
- **存储**: Supabase Storage
- **传输**: stdio (标准输入输出)

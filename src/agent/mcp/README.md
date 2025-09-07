sequenceDiagram
    autonumber
    participant C as "MCP Client"
    participant S as "HTTP Server (/mcp)"
    participant T as "StreamableHTTPServerTransport"
    participant M as "MCP Server (McpServer)"

    Note over C,S: 初始化会话（创建 sessionId）
    C->>S: POST "/mcp"\nHeaders: {"Content-Type":"application/json"}\nBody: { jsonrpc:"2.0", method:"initialize", ... }
    S->>T: new Transport({ sessionIdGenerator, onsessioninitialized })
    T->>M: server.connect(transport)
    S-->>C: 200 OK\nHeaders: {"Mcp-Session-Id":"<sessionId>"}\nBody: initialize result

    Note over C,S: 复用会话发起请求（必须携带 mcp-session-id）
    C->>S: POST "/mcp"\nHeaders: {"mcp-session-id":"<sessionId>"}\nBody: JSON-RPC 请求
    S->>T: transport.handleRequest(req, res, body)
    T->>M: 路由到对应 tool/prompt/resource
    M-->>T: JSON-RPC 响应
    T-->>S: 响应
    S-->>C: 200 OK + JSON-RPC 结果

    Note over C,S: 拉取/接收服务端消息（按实现，可选）
    C->>S: GET "/mcp"\nHeaders: {"mcp-session-id":"<sessionId>"}
    S->>T: transport.handleRequest(req, res)
    T-->>C: 流式/分块返回消息（例如事件/增量）

    Note over C,S: 关闭会话
    C->>S: DELETE "/mcp"\nHeaders: {"mcp-session-id":"<sessionId>"}
    S->>T: transport.handleRequest(req, res)（触发 onclose 清理）
    T-->>S: onclose -> 删除缓存的 transport
    S-->>C: 200 OK

    Note over C,S: 异常场景
    C->>S: GET/POST "/mcp"（缺失或无效 mcp-session-id）
    S-->>C: 400 Bad Request\n{"error":"Invalid or missing session id"}

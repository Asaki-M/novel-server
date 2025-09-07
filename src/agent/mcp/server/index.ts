import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import cors from 'cors'
import express from 'express'

export class MCPServer {
  private app: express.Application
  private mcpServer: McpServer

  constructor(name: string, version: string) {
    this.mcpServer = new McpServer({
      name,
      version,
    })
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware() {
    this.app.use(express.json())
    this.app.use(cors({
      origin: '*', // 在生产环境中应配置为更严格的源
      exposedHeaders: ['Mcp-Session-Id'],
      allowedHeaders: ['Content-Type', 'mcp-session-id'],
    }))
  }

  private setupRoutes() {
    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

    // Handle POST requests for client-to-server communication
    this.app.post('/mcp', async (req: express.Request, res: express.Response) => {
      // Check for existing session ID
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport: StreamableHTTPServerTransport

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId]
      }
      else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // Store the transport by session ID
            transports[sessionId] = transport
          },
          // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
          // locally, make sure to set:
          // enableDnsRebindingProtection: true,
          // allowedHosts: ['127.0.0.1'],
        })

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId]
          }
        }

        // ... set up server resources, tools, and prompts ...

        // Connect to the MCP server
        await this.mcpServer.connect(transport)
      }
      else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        })
        return
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body)
    })
    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }

      const transport = transports[sessionId]
      await transport.handleRequest(req, res)
    }

    this.app.delete('/mcp', handleSessionRequest)
    this.app.get('/mcp', handleSessionRequest)
  }

  public get mcp(): McpServer {
    return this.mcpServer
  }

  public listen(port: number, host: string): Promise<void> {
    // 启动MCP服务
    return new Promise((resolve) => {
      this.app.listen(port, host, () => {
        resolve()
      })
    })
  }
}

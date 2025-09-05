import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { createLogger } from '@/utils/logger.js'

const logger = createLogger('MCPClient')

export interface ExternalMcpServerConfig {
  name: string
  version: string
  url: string
}

export class MCPClient {
  private client: Client | undefined

  constructor(name: string, version: string) {
    this.client = new Client({
      name,
      version,
    })
  }

  public async connect(url: string) {
    try {
      const transport = new StreamableHTTPClientTransport(
        new URL(url),
      )
      await this.client?.connect(transport as any)
      logger.info('连接成功, url: ', url)
    }
    catch {
      logger.error('连接失败, url: ', url)
    }
  }

  public callTool(toolName: string, toolParams: any) {
    logger.info('调用工具, toolName: ', toolName, 'toolParams: ', toolParams)
    return this.client?.callTool({
      name: toolName,
      arguments: toolParams,
    })
  }

  public getAllTools() {
    logger.info('获取所有工具...')
    return this.client?.listTools()
  }
}

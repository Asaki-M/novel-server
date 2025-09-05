import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ExternalMcpServerConfig } from './mcp/client/index.js'
import { MCPClient } from './mcp/client/index.js'

export class Agent {
  private llm: BaseChatModel
  private systemPrompt: string
  private mcpServers: ExternalMcpServerConfig[]

  constructor(llm: BaseChatModel, systemPrompt: string, mcpServers: ExternalMcpServerConfig[]) {
    this.llm = llm
    this.systemPrompt = systemPrompt
    this.mcpServers = mcpServers
  }

  public async initAgent() {
    this.mcpServers.forEach(async (server) => {
      const client = new MCPClient(server.name, server.version)
      await client.connect(server.url)
    })
  }
}

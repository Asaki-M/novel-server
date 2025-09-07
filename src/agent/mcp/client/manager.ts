import type { ExternalMcpServerConfig } from './index.js'
import { createLogger } from '../../../utils/logger.js'
import { MCPClient } from './index.js'

const logger = createLogger('MCPClientManager')

/**
 * MCP 客户端管理器
 * 负责管理多个 MCP 客户端的连接、工具调用和生命周期
 */
export class MCPClientManager {
  /** 存储所有已连接的客户端实例 */
  private clients: Map<string, MCPClient> = new Map()

  /** 存储客户端配置信息 */
  private clientConfigs: Map<string, ExternalMcpServerConfig> = new Map()

  /** 存储客户端连接状态 */
  private connectionStatus: Map<string, boolean> = new Map()

  /**
   * 添加新的 MCP 客户端
   * @param config - 外部 MCP 服务器配置
   */
  public async addClient(config: ExternalMcpServerConfig): Promise<void> {
    const { name, version, url } = config

    logger.info(`正在添加客户端: ${name}`)

    try {
      // 创建新的客户端实例
      const client = new MCPClient(name, version)

      // 尝试连接到服务器
      await client.connect(url)

      // 存储客户端信息
      this.clients.set(name, client)
      this.clientConfigs.set(name, config)
      this.connectionStatus.set(name, true)

      logger.info(`客户端 ${name} 添加成功`)
    }
    catch (error) {
      logger.error(`客户端 ${name} 添加失败:`, error)
      this.connectionStatus.set(name, false)
      throw error
    }
  }

  /**
   * 批量添加多个 MCP 客户端
   * @param configs - 多个外部 MCP 服务器配置
   */
  public async addMultipleClients(configs: ExternalMcpServerConfig[]): Promise<void> {
    logger.info(`正在批量添加 ${configs.length} 个客户端`)

    // 并行连接所有客户端，提高性能
    const connectionPromises = configs.map(async (config) => {
      try {
        await this.addClient(config)
        return { success: true, name: config.name }
      }
      catch (error) {
        logger.error(`客户端 ${config.name} 连接失败:`, error)
        return { success: false, name: config.name, error }
      }
    })

    const results = await Promise.allSettled(connectionPromises)

    // 统计连接结果
    const successCount = results.filter(result =>
      result.status === 'fulfilled' && result.value.success,
    ).length

    logger.info(`批量连接完成: ${successCount}/${configs.length} 个客户端连接成功`)
  }

  /**
   * 移除指定的客户端
   * @param clientName - 客户端名称
   */
  public removeClient(clientName: string): void {
    if (this.clients.has(clientName)) {
      this.clients.delete(clientName)
      this.clientConfigs.delete(clientName)
      this.connectionStatus.delete(clientName)
      logger.info(`客户端 ${clientName} 已移除`)
    }
    else {
      logger.warn(`客户端 ${clientName} 不存在`)
    }
  }

  /**
   * 调用指定客户端的工具
   * @param clientName - 客户端名称
   * @param toolName - 工具名称
   * @param toolParams - 工具参数
   * @returns 工具调用结果
   */
  public async callTool(clientName: string, toolName: string, toolParams: any): Promise<any> {
    const client = this.clients.get(clientName)

    if (!client) {
      throw new Error(`客户端 ${clientName} 不存在`)
    }

    if (!this.connectionStatus.get(clientName)) {
      throw new Error(`客户端 ${clientName} 未连接`)
    }

    logger.info(`通过客户端 ${clientName} 调用工具 ${toolName}`)

    try {
      const result = await client.callTool(toolName, toolParams)
      logger.info(`工具调用成功: ${clientName}.${toolName}`)
      return result
    }
    catch (error) {
      logger.error(`工具调用失败: ${clientName}.${toolName}`, error)
      throw error
    }
  }

  /**
   * 获取指定客户端的所有可用工具
   * @param clientName - 客户端名称
   * @returns 工具列表
   */
  public async getClientTools(clientName: string): Promise<any> {
    const client = this.clients.get(clientName)

    if (!client) {
      throw new Error(`客户端 ${clientName} 不存在`)
    }

    if (!this.connectionStatus.get(clientName)) {
      throw new Error(`客户端 ${clientName} 未连接`)
    }

    logger.info(`获取客户端 ${clientName} 的工具列表`)

    try {
      const tools = await client.getAllTools()
      logger.info(`成功获取客户端 ${clientName} 的工具列表`)
      return tools
    }
    catch (error) {
      logger.error(`获取客户端 ${clientName} 工具列表失败:`, error)
      throw error
    }
  }

  /**
   * 获取所有客户端的工具汇总
   * @returns 所有客户端的工具映射
   */
  public async getAllTools(): Promise<Record<string, any>> {
    const allTools: Record<string, any> = {}

    logger.info('正在获取所有客户端的工具列表')

    // 并行获取所有客户端的工具
    const toolPromises = Array.from(this.clients.keys()).map(async (clientName) => {
      try {
        const tools = await this.getClientTools(clientName)
        return { clientName, tools, success: true }
      }
      catch (error) {
        logger.error(`获取客户端 ${clientName} 工具失败:`, error)
        return { clientName, tools: null, success: false, error }
      }
    })

    const results = await Promise.allSettled(toolPromises)

    // 汇总结果
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        allTools[result.value.clientName] = result.value.tools
      }
    })

    logger.info(`成功获取 ${Object.keys(allTools).length} 个客户端的工具列表`)

    return allTools
  }

  /**
   * 清理所有客户端连接
   */
  public cleanup(): void {
    logger.info('正在清理所有客户端连接')

    this.clients.clear()
    this.clientConfigs.clear()
    this.connectionStatus.clear()

    logger.info('所有客户端连接已清理完毕')
  }
}

// 导出单例实例
export const mcpClientManager = new MCPClientManager()

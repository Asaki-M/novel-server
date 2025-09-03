import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * MCP 客户端
 *
 * 负责与 MCP 服务器通信，调用工具
 * 简化版实现，专注于核心功能
 */

export interface MCPToolResult {
  success: boolean
  data?: any
  error?: string
}

export class MCPClient {
  private serverPath: string

  constructor() {
    // MCP 服务器路径
    this.serverPath = path.join(__dirname, 'server.js')
  }

  /**
   * 调用 MCP 工具
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns Promise<MCPToolResult> - 调用结果
   */
  async callTool(toolName: string, args: any): Promise<MCPToolResult> {
    return new Promise((resolve) => {
      let process: ChildProcess | null = null
      let responseData = ''
      let errorData = ''
      let isResolved = false

      // 超时处理
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          if (process) {
            process.kill('SIGTERM')
          }
          resolve({
            success: false,
            error: 'MCP 调用超时',
          })
        }
      }, 120000) // 2min 超时

      try {
        console.log(`🚀 启动 MCP 服务器进程: ${this.serverPath}`)

        // 启动 MCP 服务器进程
        process = spawn('node', [this.serverPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        // 构建请求
        const request = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        }

        console.log(`📤 发送 MCP 请求:`, JSON.stringify(request, null, 2))

        // 发送请求
        if (process.stdin) {
          process.stdin.write(`${JSON.stringify(request)}\n`)
          process.stdin.end()
        }
        else {
          throw new Error('无法写入 MCP 进程的 stdin')
        }

        // 处理响应
        if (process.stdout) {
          process.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString()
            console.log(`📥 MCP stdout 数据:`, chunk)
            responseData += chunk
          })
        }

        if (process.stderr) {
          process.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString()
            console.log(`⚠️ MCP stderr 数据:`, chunk)
            errorData += chunk
          })
        }

        // 进程结束处理
        process.on('close', (code: number) => {
          if (isResolved)
            return
          isResolved = true
          clearTimeout(timeout)

          console.log(`🏁 MCP 进程结束，退出码: ${code}`)
          console.log(`📊 响应数据长度: ${responseData.length}, 错误数据长度: ${errorData.length}`)

          if (responseData) {
            console.log(`📄 完整响应数据:`, responseData)
          }
          if (errorData) {
            console.log(`❌ 错误数据:`, errorData)
          }

          if (code === 0) {
            try {
              // 解析响应
              const lines = responseData.trim().split('\n')
              let response = null

              console.log(`🔍 解析响应，共 ${lines.length} 行`)

              // 查找有效的 JSON 响应
              for (const line of lines) {
                if (!line.trim())
                  continue
                try {
                  const parsed = JSON.parse(line)
                  console.log(`✅ 解析成功:`, parsed)
                  if (parsed.jsonrpc === '2.0' && parsed.id) {
                    response = parsed
                    break
                  }
                }
                catch (parseErr) {
                  console.log(`⚠️ 解析失败:`, line, parseErr)
                  // 忽略解析错误，继续查找
                }
              }

              if (response?.result?.content?.[0]?.text) {
                const toolResult = JSON.parse(response.result.content[0].text)
                resolve({
                  success: true,
                  data: toolResult,
                })
              }
              else if (response?.error) {
                resolve({
                  success: false,
                  error: response.error.message || 'MCP 工具调用失败',
                })
              }
              else {
                resolve({
                  success: false,
                  error: 'MCP 响应格式无效',
                })
              }
            }
            catch (parseError) {
              resolve({
                success: false,
                error: `解析 MCP 响应失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`,
              })
            }
          }
          else {
            resolve({
              success: false,
              error: `MCP 进程异常退出 (code: ${code}): ${errorData}`,
            })
          }
        })

        // 进程错误处理
        process.on('error', (error) => {
          if (isResolved)
            return
          isResolved = true
          clearTimeout(timeout)

          resolve({
            success: false,
            error: `MCP 进程启动失败: ${error.message}`,
          })
        })
      }
      catch (error) {
        if (isResolved)
          return
        isResolved = true
        clearTimeout(timeout)

        resolve({
          success: false,
          error: `MCP 调用异常: ${error instanceof Error ? error.message : '未知错误'}`,
        })
      }
    })
  }

  /**
   * 意图识别
   * @param message - 用户消息
   * @param context - 对话上下文
   * @returns Promise<MCPToolResult> - 识别结果
   */
  async recognizeIntent(
    message: string,
    context?: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
  ): Promise<MCPToolResult> {
    console.log(`🧠 MCP 意图识别: ${message.substring(0, 50)}...`)

    const result = await this.callTool('intent_recognition', {
      message,
      context,
    })

    if (result.success) {
      console.log(`✅ 意图识别完成: ${result.data?.intent} (${result.data?.confidence})`)
    }
    else {
      console.error(`❌ 意图识别失败: ${result.error}`)
    }

    return result
  }

  /**
   * 生成插画
   * @param input - 生成参数
   * @returns Promise<MCPToolResult> - 生成结果
   */
  async generateIllustration(input: {
    prompt: string
    sessionId: string
    style?: string
    size?: '512x512' | '768x768' | '1024x1024'
    quality?: 'standard' | 'high'
  }): Promise<MCPToolResult> {
    console.log(`🎨 MCP 图片生成: ${input.prompt.substring(0, 50)}...`)

    const result = await this.callTool('generate_illustration', {
      prompt: input.prompt,
      sessionId: input.sessionId,
      style: input.style || 'anime',
      size: input.size || '512x512',
      quality: input.quality || 'high',
    })

    if (result.success) {
      if (result.data?.url) {
        console.log(`✅ 图片生成完成: ${result.data.url}`)
      }
      else if (result.data?.base64) {
        console.log(`✅ 图片生成完成 (base64)`)
      }
      else {
        console.log(`⚠️ 图片生成完成，但格式异常`)
      }
    }
    else {
      console.error(`❌ 图片生成失败: ${result.error}`)
    }

    return result
  }

  /**
   * 健康检查
   * 验证 MCP 服务器是否正常工作
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.recognizeIntent('测试消息')
      return result.success
    }
    catch {
      return false
    }
  }
}

// 导出单例实例
export default new MCPClient()

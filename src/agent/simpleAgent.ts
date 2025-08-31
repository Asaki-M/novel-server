import { ChatOpenAI } from "@langchain/openai";
import config from "../config/index.js";
import mcpClient, { MCPClient } from "../mcp/client.js";
import { InferenceClient } from "@huggingface/inference";
import imageStorageService from "../services/imageStorageService.js";
import langchainService from "../services/langchainService.js";

/**
 * 简洁的 LangChain Agent
 * 
 * 架构：LangChain Agent → MCP Client → MCP Server → Tools
 * 
 * 功能：
 * 1. 使用 LangChain 进行对话和记忆管理
 * 2. 通过 MCP 客户端调用工具
 * 3. 保持现有的角色卡和会话记录功能
 */

export interface SimpleAgentOptions {
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  systemPrompt?: string;
  verbose?: boolean;
}

export interface SimpleAgentResult {
  output: string;
  toolsUsed?: string[];
  intermediateSteps?: any[];
}

export class SimpleAgent {
  private mcpClient: MCPClient;

  constructor() {
    this.mcpClient = mcpClient;
  }

  /**
   * 直接调用图片生成（绕过 MCP 通信问题）
   */
  private async generateImageDirect(prompt: string, sessionId: string): Promise<any> {
    try {
      console.log(`🎨 直接生成图片: ${prompt}`);

      // 检查 HuggingFace Token
      const token = process.env['HF_TOKEN'];
      if (!token) {
        throw new Error('HF_TOKEN 环境变量未配置');
      }

      // 创建推理客户端
      const client = new InferenceClient(token);

      // 增强提示词
      let enhancedPrompt = `${prompt}, anime style, high quality, detailed, masterpiece`;

      console.log(`🎯 使用提示词: ${enhancedPrompt}`);

      // 使用指定的模型生成图片
      console.log(`🎯 使用模型: starsfriday/Qwen-Image-NSFW`);

      const output = await client.textToImage({
        provider: "auto",
        model: "starsfriday/Qwen-Image-NSFW",
        inputs: enhancedPrompt,
        parameters: {
          num_inference_steps: 20,
          guidance_scale: 7.5
        },
      });

      console.log(`✅ 模型调用成功`);


      if (!output) {
        return {
          success: false,
          error: `图片生成服务暂时不可用: 网络连接问题。请稍后重试或检查网络连接。`
        };
      }

      console.log(`📸 HuggingFace API 调用成功，输出类型: ${typeof output}, 构造函数: ${output?.constructor?.name}`);

      // 检查输出是否为 Blob
      const outputAny = output as any;
      if (outputAny && typeof outputAny === 'object' && outputAny.constructor?.name === 'Blob') {
        console.log(`📦 检测到 Blob 格式，大小: ${outputAny.size} 字节，类型: ${outputAny.type}`);

        // 直接上传 Blob 到存储服务
        try {
          const storageResult = await imageStorageService.uploadBlob(outputAny, sessionId);
          console.log(`✅ 图片上传成功: ${storageResult.url}`);

          return {
            success: true,
            data: {
              url: storageResult.url,
              prompt: prompt,
              timestamp: Date.now()
            }
          };
        } catch (uploadError) {
          console.warn('Blob 上传失败:', uploadError);

          return {
            success: false,
            error: `图片上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}`
          };
        }
      } else {
        // 如果不是 Blob，返回错误
        console.error('输出格式不是 Blob:', output);
        return {
          success: false,
          error: `不支持的输出格式: ${typeof output}，期望 Blob 格式`
        };
      }

    } catch (error) {
      console.error('直接图片生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片生成失败'
      };
    }
  }

  /**
   * 创建 LLM 实例
   * OpenRouter API 与 LangChain 完全兼容
   */
  private createLLM(options: { temperature?: number; maxTokens?: number } = {}): ChatOpenAI {
    const init: any = {
      apiKey: config.openrouter.apiKey,
      model: config.openrouter.model,
      temperature: options.temperature ?? 0.7,
      configuration: {
        baseURL: config.openrouter.baseUrl,
        defaultHeaders: {
          "HTTP-Referer": config.app.referer,
          "X-Title": config.app.name,
        },
      },
    };
    
    if (typeof options.maxTokens === 'number') {
      init.maxTokens = options.maxTokens;
    }
    
    return new ChatOpenAI(init);
  }

  /**
   * 执行用户请求
   * 
   * 流程：
   * 1. 通过 MCP 进行意图识别
   * 2. 根据意图选择处理方式
   * 3. 使用 LangChain 的记忆功能
   */
  async execute(input: string, options: SimpleAgentOptions = {}): Promise<SimpleAgentResult> {
    try {
      console.log(`🤖 SimpleAgent 开始处理: ${input.substring(0, 100)}...`);

      const toolsUsed: string[] = [];
      const intermediateSteps: any[] = [];

      // 第一步：意图识别（通过 MCP）
      const intentResult = await this.mcpClient.recognizeIntent(input);
      
      if (!intentResult.success) {
        console.warn('意图识别失败，使用默认策略');
        // 回退到简单的关键词匹配
        const imageKeywords = ['生成', '画', '创作', '制作', '图片', '插画', '图像'];
        const needsImage = imageKeywords.some(keyword => input.includes(keyword));
        
        if (needsImage && options.sessionId) {
          return await this.handleImageGeneration(input, options, toolsUsed, intermediateSteps);
        } else {
          return await this.handleNormalChat(input, options, toolsUsed, intermediateSteps);
        }
      }

      toolsUsed.push('intent_recognition');
      intermediateSteps.push({
        action: 'intent_recognition',
        result: intentResult.data
      });

      const { intent, confidence } = intentResult.data;
      console.log(`🎯 意图识别结果: ${intent} (置信度: ${confidence})`);

      // 第二步：根据意图执行相应操作
      if (intent === 'text_to_image' && confidence >= 0.6) {
        if (!options.sessionId) {
          throw new Error('生成图片需要提供 sessionId');
        }
        return await this.handleImageGeneration(input, options, toolsUsed, intermediateSteps);
      } else {
        return await this.handleNormalChat(input, options, toolsUsed, intermediateSteps);
      }

    } catch (error) {
      console.error('SimpleAgent 执行失败:', error);
      return {
        output: `抱歉，处理您的请求时出现了错误：${error instanceof Error ? error.message : '未知错误'}`,
        toolsUsed: [],
        intermediateSteps: []
      };
    }
  }

  /**
   * 处理图片生成请求
   */
  private async handleImageGeneration(
    input: string, 
    options: SimpleAgentOptions,
    toolsUsed: string[],
    intermediateSteps: any[]
  ): Promise<SimpleAgentResult> {
    try {
      console.log('🎨 处理图片生成请求');

      // 直接生成图片（绕过 MCP 通信问题）
      const imageResult = await this.generateImageDirect(input, options.sessionId!);

      toolsUsed.push('generate_illustration_direct');
      intermediateSteps.push({
        action: 'generate_illustration_direct',
        result: imageResult.data
      });
      console.log('🔍 图片生成结果:', imageResult);

      if (!imageResult.success) {
        const result: SimpleAgentResult = {
          output: `抱歉，图片生成失败：${imageResult.error}`,
          toolsUsed
        };
        if (options.verbose) {
          result.intermediateSteps = intermediateSteps;
        }
        return result;
      }

      const data = imageResult.data;
      let output: string;

      console.log(imageResult, 'test');
      if (data.error) {
        output = `抱歉，图片生成失败：${data.message}`;
      } else if (data.url) {
        output = `我已经为您生成了一张图片！\n\n🖼️ 图片链接：${data.url}\n📝 生成提示词：${data.prompt}`;
      } else if (data.base64) {
        output = `我已经为您生成了一张图片！\n\n📝 生成提示词：${data.prompt}\n💾 图片已生成完成（base64格式）`;
      } else {
        output = '图片生成完成，但返回格式异常。';
      }

      // 保存对话记录到数据库（包含图片URL）
      if (options.sessionId && !data.error) {
        try {
          await langchainService.saveMessages(options.sessionId, [
            { role: 'user', content: input },
            { role: 'assistant', content: output }
          ]);
          console.log('✅ 图片生成对话记录已保存到数据库');
        } catch (memoryError) {
          console.warn('⚠️ 保存图片生成对话记录失败:', memoryError);
        }
      }

      const result: SimpleAgentResult = {
        output,
        toolsUsed
      };
      if (options.verbose) {
        result.intermediateSteps = intermediateSteps;
      }
      return result;

    } catch (error) {
      console.error('图片生成处理失败:', error);
      const result: SimpleAgentResult = {
        output: `图片生成过程中出现错误：${error instanceof Error ? error.message : '未知错误'}`,
        toolsUsed
      };
      if (options.verbose) {
        result.intermediateSteps = intermediateSteps;
      }
      return result;
    }
  }

  /**
   * 处理普通聊天请求
   * 使用 LangChain 的记忆和上下文管理功能
   */
  private async handleNormalChat(
    input: string, 
    options: SimpleAgentOptions,
    toolsUsed: string[],
    intermediateSteps: any[]
  ): Promise<SimpleAgentResult> {
    try {
      console.log('💬 处理普通聊天请求');

      // 构建 LangChain 调用选项
      const langchainOptions: any = {
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        systemPrompt: options.systemPrompt,
        sessionId: options.sessionId
      };

      let output: string;

      if (options.sessionId) {
        // 使用带记忆的调用（保持现有功能）
        const result = await langchainService.invokeWithMemory(
          [{ role: 'user', content: input }],
          langchainOptions
        );
        output = result.content;
        
        toolsUsed.push('langchain_with_memory');
        intermediateSteps.push({
          action: 'langchain_with_memory',
          result: { content: output, usage: result.usage }
        });
      } else {
        // 无记忆的简单调用
        const result = await langchainService.invoke(
          [{ role: 'user', content: input }],
          langchainOptions
        );
        output = result.content;
        
        toolsUsed.push('langchain_simple');
        intermediateSteps.push({
          action: 'langchain_simple',
          result: { content: output, usage: result.usage }
        });
      }

      const result: SimpleAgentResult = {
        output,
        toolsUsed
      };
      if (options.verbose) {
        result.intermediateSteps = intermediateSteps;
      }
      return result;

    } catch (error) {
      console.error('普通聊天处理失败:', error);
      const result: SimpleAgentResult = {
        output: `聊天处理过程中出现错误：${error instanceof Error ? error.message : '未知错误'}`,
        toolsUsed
      };
      if (options.verbose) {
        result.intermediateSteps = intermediateSteps;
      }
      return result;
    }
  }

  /**
   * 流式执行（简化版）
   */
  async *executeStream(input: string, options: SimpleAgentOptions = {}): AsyncGenerator<string, void, unknown> {
    try {
      // 先进行意图识别
      yield '🧠 正在分析您的请求...\n';
      
      const intentResult = await this.mcpClient.recognizeIntent(input);
      
      if (intentResult.success) {
        const { intent, confidence } = intentResult.data;
        yield `🎯 意图识别: ${intent === 'text_to_image' ? '图片生成' : '普通聊天'} (置信度: ${confidence})\n`;

        // 调试信息
        console.log(`🔍 流式响应调试 - 意图: ${intent}, 置信度: ${confidence}, sessionId: ${options.sessionId ? '存在' : '缺失'}`);

        if (intent === 'text_to_image' && confidence >= 0.6) {
          if (!options.sessionId) {
            yield '❌ 错误：生成图片需要提供会话ID\n';
            return;
          }

          // 图片生成流程
          yield '🎨 正在生成图片，请稍候...\n';

          try {
            const result = await this.handleImageGeneration(input, options, [], []);
            yield result.output;
          } catch (error) {
            yield `❌ 图片生成失败：${error instanceof Error ? error.message : '未知错误'}\n`;
          }
        } else {
          // 普通聊天流程
          if (intent === 'text_to_image' && confidence <= 0.6) {
            yield `💭 置信度较低 (${confidence})，按普通聊天处理...\n`;
          } else {
            yield '💭 正在思考回答...\n';
          }

          try {
            const result = await this.handleNormalChat(input, options, [], []);

            // 分块输出
            const chunks = result.output.split(/[。！？.!?]/);
            for (const chunk of chunks) {
              if (chunk.trim()) {
                yield chunk.trim() + '。';
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
          } catch (error) {
            yield `❌ 聊天处理失败：${error instanceof Error ? error.message : '未知错误'}\n`;
          }
        }
      } else {
        yield '⚠️ 意图识别失败，使用默认处理\n';
        const result = await this.execute(input, options);
        yield result.output;
      }
      
    } catch (error) {
      yield `❌ 处理请求时出现错误：${error instanceof Error ? error.message : '未知错误'}\n`;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ agent: boolean; mcp: boolean }> {
    try {
      // 检查 LangChain 服务
      const agentHealthy = await this.testLangChain();
      
      // 检查 MCP 服务
      const mcpHealthy = await this.mcpClient.healthCheck();
      
      return { agent: agentHealthy, mcp: mcpHealthy };
    } catch {
      return { agent: false, mcp: false };
    }
  }

  /**
   * 测试 LangChain 服务
   */
  private async testLangChain(): Promise<boolean> {
    try {
      const result = await langchainService.invoke(
        [{ role: 'user', content: '测试' }],
        { temperature: 0.1, max_tokens: 10 }
      );
      return !!result.content;
    } catch {
      return false;
    }
  }
}

// 导出单例实例
export default new SimpleAgent();

#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { InferenceClient } from "@huggingface/inference";
import langchainService from '../services/langchainService.js';
import imageStorageService from '../services/imageStorageService.js';

// 创建 MCP 服务器
const server = new Server(
  {
    name: "novel-server-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 意图识别实现
async function recognizeIntent(
  message: string,
  context?: Array<{ role: 'user' | 'assistant' | 'system', content: string }>
) {
  const contextStr = context
    ? context.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')
    : '';

  const prompt = `分析用户消息意图，判断是否需要生成图片。

${contextStr ? `上下文：\n${contextStr}\n\n` : ''}用户消息：${message}

返回JSON格式：
{
  "intent": "text_to_image" | "normal_chat",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由"
}`;

  try {
    const result = await langchainService.invoke([{ role: 'user', content: prompt }], {
      temperature: 0.1,
      max_tokens: 150,
    });

    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        intent: result.content.includes('text_to_image') ? 'text_to_image' : 'normal_chat',
        confidence: 0.5,
        reasoning: '解析失败'
      };
    }

    return {
      intent: parsed.intent === 'text_to_image' ? 'text_to_image' : 'normal_chat',
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || '无推理过程'
    };
  } catch (error) {
    return {
      intent: 'normal_chat' as const,
      confidence: 0.5,
      reasoning: '服务异常'
    };
  }
}

// 文生图实现
async function generateIllustration(input: {
  prompt: string;
  sessionId: string;
  style: string;
  size: '512x512' | '768x768' | '1024x1024';
  quality: 'standard' | 'high';
}) {
  const token = process.env['HF_TOKEN'];
  if (!token) {
    throw new Error('HF_TOKEN 未配置');
  }

  const client = new InferenceClient(token);

  let enhancedPrompt = input.prompt;
  enhancedPrompt = `${enhancedPrompt}, ${input.style} style`;
  if (input.quality === 'high') {
    enhancedPrompt = `${enhancedPrompt}, high quality, detailed`;
  }

  const output: any = await client.textToImage({
    model: 'black-forest-labs/FLUX.1-schnell',
    inputs: enhancedPrompt,
  });

  // 处理图片数据
  let dataUrl: string;
  if (output instanceof ArrayBuffer) {
    const base64 = Buffer.from(output).toString('base64');
    dataUrl = `data:image/png;base64,${base64}`;
  } else if (output instanceof Uint8Array) {
    const base64 = Buffer.from(output).toString('base64');
    dataUrl = `data:image/png;base64,${base64}`;
  } else {
    dataUrl = String(output);
  }

  try {
    const storageResult = await imageStorageService.uploadDataUrl(dataUrl, input.sessionId);
    return {
      url: storageResult.url,
      prompt: input.prompt,
      timestamp: Date.now()
    };
  } catch {
    return {
      base64: dataUrl.replace(/^data:image\/[^;]+;base64,/, ''),
      prompt: input.prompt,
      timestamp: Date.now()
    };
  }
}

// 定义工具参数 schema
const intentRecognitionSchema = z.object({
  message: z.string(),
  context: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })).optional()
});

const generateIllustrationSchema = z.object({
  prompt: z.string(),
  sessionId: z.string(),
  style: z.string().default('anime'),
  size: z.enum(['512x512', '768x768', '1024x1024']).default('512x512'),
  quality: z.enum(['standard', 'high']).default('high')
});

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "intent_recognition") {
    const validatedArgs = intentRecognitionSchema.parse(args);
    const result = await recognizeIntent(validatedArgs.message, validatedArgs.context);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "generate_illustration") {
    const validatedArgs = generateIllustrationSchema.parse(args);
    const result = await generateIllustration(validatedArgs);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  throw new Error(`未知工具: ${name}`);
});

// 工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "intent_recognition",
        description: "识别用户消息的意图，判断是否需要生成图片",
        inputSchema: {
          type: "object",
          properties: {
            message: { type: "string", description: "用户消息内容" },
            context: {
              type: "array",
              description: "对话上下文",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "assistant", "system"] },
                  content: { type: "string" }
                }
              }
            }
          },
          required: ["message"]
        }
      },
      {
        name: "generate_illustration",
        description: "根据文本描述生成插画图片",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "图片生成提示词" },
            sessionId: { type: "string", description: "会话ID" },
            style: { type: "string", description: "图片风格", default: "anime" },
            size: {
              type: "string",
              enum: ["512x512", "768x768", "1024x1024"],
              description: "图片尺寸",
              default: "512x512"
            },
            quality: {
              type: "string",
              enum: ["standard", "high"],
              description: "图片质量",
              default: "high"
            }
          },
          required: ["prompt", "sessionId"]
        }
      }
    ]
  };
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 标准 MCP 服务器已启动");
}

main().catch(console.error);

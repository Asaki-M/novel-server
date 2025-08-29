import { Request, Response, NextFunction } from 'express';
import langchainService from '../services/langchainService.js';
import characterService from '../services/characterService.js';
import { ChatRequest, ChatResponse, ApiResponse } from '../types/chat.js';
import { CreateCharacterRequest, UpdateCharacterRequest } from '../types/character.js';

// 通用的参数验证和角色卡处理函数
const validateAndProcessRequest = async (req: Request) => {
  const {
    messages,
    temperature,
    max_tokens,
    characterId,      // 必填：角色卡ID
    sessionId         // 必填：会话ID
  } = req.body as ChatRequest & {
    characterId: string;
    sessionId: string;
  };

  // 验证基本参数
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('请提供有效的消息数组');
  }

  // sessionId 和 characterId 是必填的
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId 是必需的');
  }

  if (!characterId || typeof characterId !== 'string' || characterId.trim().length === 0) {
    throw new Error('characterId 是必需的');
  }

  // 功能默认启用，无需额外配置


  let systemPrompt: string | undefined = undefined;


  // 处理角色卡
  if (characterId) {
    const character = await characterService.getCharacter(characterId);
    if (character) {
      systemPrompt = character.systemPrompt;
      console.log('🎭 使用角色卡:', character.name);
    } else {
      console.warn('角色卡不存在:', characterId);
    }
  }

  return {
    messages,
    temperature,
    max_tokens,
    sessionId,
    systemPrompt
  };
};

// 正常响应接口 - /chat
export const chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      messages,
      temperature,
      max_tokens,
      sessionId,
      systemPrompt
    } = await validateAndProcessRequest(req);

    // 使用 LangChain 服务，启用记忆功能
    const result = await langchainService.invoke(messages, {
      temperature,
      max_tokens,
      systemPrompt,
      sessionId
    });

    const response: ChatResponse = {
      success: true,
      message: result.content
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// 流式响应接口 - /chat/stream
export const chatStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { messages } = req.body as ChatRequest & { sessionId: string; characterId: string };

    const {
      temperature,
      max_tokens,
      sessionId,
      systemPrompt
    } = await validateAndProcessRequest(req);

    // 设置流式响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 使用 LangChain 流式响应（默认启用记忆）
    for await (const delta of langchainService.streamWithMemory(messages, {
      temperature,
      max_tokens,
      systemPrompt,
      sessionId,
      summaryWindow: 12,
      summaryMaxTokens: 400,
    })) {
      if (delta) {
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (error instanceof Error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    next(error);
  }
};



// ==================== 角色卡管理 ====================

/**
 * 获取角色卡列表
 */
export const getCharacters = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const list = await characterService.listCharacters();

    const response: ApiResponse = {
      success: true,
      data: list
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取角色卡详情
 */
export const getCharacter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { characterId } = req.params;
    
    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空'
      };
      res.status(400).json(response);
      return;
    }
    
    const character = await characterService.getCharacter(characterId);

    if (!character) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: character
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 创建角色卡
 */
export const createCharacter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const characterData: CreateCharacterRequest = req.body;

    // 验证必填字段
    if (!characterData.name || !characterData.description || !characterData.systemPrompt) {
      const response: ApiResponse = {
        success: false,
        error: '角色名称、描述和系统提示词为必填项'
      };
      res.status(400).json(response);
      return;
    }

    const character = await characterService.createCharacter(characterData);

    const response: ApiResponse = {
      success: true,
      message: '角色卡创建成功',
      data: character
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新角色卡
 */
export const updateCharacter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { characterId } = req.params;
    const updates: UpdateCharacterRequest = req.body;

    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空'
      };
      res.status(400).json(response);
      return;
    }

    const character = await characterService.updateCharacter(characterId, updates);

    if (!character) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在或无法修改内置角色'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: '角色卡更新成功',
      data: character
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 删除角色卡
 */
export const deleteCharacter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { characterId } = req.params;
    
    if (!characterId) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡ID不能为空'
      };
      res.status(400).json(response);
      return;
    }
    
    const deleted = await characterService.deleteCharacter(characterId);

    if (!deleted) {
      const response: ApiResponse = {
        success: false,
        error: '角色卡不存在或无法删除内置角色'
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: '角色卡删除成功'
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};
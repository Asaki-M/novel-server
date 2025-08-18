import { Request, Response, NextFunction } from 'express';
import openaiService from '../services/openaiService.js';
import characterService from '../services/characterService.js';
import { ChatRequest, ChatResponse, ApiResponse } from '../types/chat.js';
import { CreateCharacterRequest, UpdateCharacterRequest } from '../types/character.js';

export const chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      messages, 
      temperature, 
      max_tokens, 
      stream,
      characterId       // 可选：角色卡ID
    }: ChatRequest & { 
      characterId?: string;
    } = req.body;

    // 验证基本参数
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const response: ChatResponse = {
        success: false,
        error: '请提供有效的消息数组'
      };
      res.status(400).json(response);
      return;
    }

    let messagesForAI = messages;
    let characterInfo: { id: string; name: string; avatar?: string; category: string; } | undefined = undefined;

    // 处理角色卡
    if (characterId) {
      const character = await characterService.getCharacter(characterId);
      if (character) {
        // 将角色的system prompt插入到消息开头
        const systemMessage = { role: 'system' as const, content: character.systemPrompt };
        messagesForAI = [systemMessage, ...messages];
        
        characterInfo = {
          id: character.id,
          name: character.name,
          avatar: character.avatar,
          category: 'custom',
        };

        console.log('🎭 使用角色卡:', character.name);
      } else {
        console.warn('角色卡不存在:', characterId);
      }
    }

    // 调用AI
    const completion = stream 
      ? await openaiService.createChatCompletion(messagesForAI, {
          temperature,
          max_tokens,
          stream: true
        })
      : await openaiService.createChatCompletion(messagesForAI, {
          temperature,
          max_tokens,
          stream: false
        });

    if (stream) {
      // 流式响应处理
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // 常规响应
      const response = completion.choices[0]?.message?.content || '';

      const result: ChatResponse = {
        success: true,
        message: characterInfo 
          ? `${characterInfo.name} 回复成功`
          : '聊天响应成功',
        data: {
          response: response,
          character: characterInfo, // 返回使用的角色信息
          usage: completion.usage ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
          } : undefined
        }
      };

      res.json(result);
    }
  } catch (error) {
    next(error);
  }
};

export const getModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const models = await openaiService.getModels();
    const response: ApiResponse = {
      success: true,
      data: models.data.filter(model => model.id.includes('qwen'))
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// ==================== 角色卡管理 ====================

/**
 * 获取角色卡列表
 */
export const getCharacters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
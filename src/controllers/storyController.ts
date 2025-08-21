import { Request, Response, NextFunction } from 'express';
import characterService from '../services/characterService.js';
import langchainService from '../services/langchainService.js';

export const bootstrapStory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { characterId, sessionId } = req.body as {
      characterId?: string;
      sessionId?: string;
    };

    if (!characterId) {
      res.status(400).json({ success: false, error: 'characterId 不能为空' });
      return;
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      res.status(400).json({ success: false, error: 'sessionId 不能为空' });
      return;
    }

    const character = await characterService.getCharacter(characterId);
    if (!character) {
      res.status(404).json({ success: false, error: '角色卡不存在' });
      return;
    }

    const backstory = character.backstory || character.backstoryPrompt || '';
    if (!backstory) {
      res.status(400).json({ success: false, error: '该角色未配置背景故事或引导词' });
      return;
    }

    // 将背景故事作为系统设定消息写入会话（记忆）
    await (langchainService as any).appendMessages(sessionId, [
      { role: 'system', content: `背景设定：${backstory}` }
    ]);

    res.json({
      success: true,
      message: '背景故事已注入会话',
      data: {
        character: { id: character.id, name: character.name },
        backstory
      }
    });
  } catch (err) {
    next(err);
  }
}; 
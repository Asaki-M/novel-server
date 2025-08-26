import { Request, Response, NextFunction } from 'express';
import supabase from '../config/supabase.js';
import imageStorageService from '../services/imageStorageService.js';

export const getSessionHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId 不能为空' });
      return;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    next(err);
  }
};

export const clearSessionHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params as { sessionId: string };
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'sessionId 不能为空' });
      return;
    }

    const { error, count } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .eq('session_id', sessionId);

    if (error) throw error;

    // 同时清理该会话的所有图片
    try {
      await imageStorageService.cleanSessionImages(sessionId);
      console.log(`已清理会话 ${sessionId} 的图片资源`);
    } catch (imageError: any) {
      console.warn(`清理会话 ${sessionId} 的图片失败:`, imageError.message);
      // 不影响主体功能，只记录警告
    }

    res.json({ success: true, message: '已清空会话记忆', data: { deleted: count ?? 0 } });
  } catch (err) {
    next(err);
  }
}; 
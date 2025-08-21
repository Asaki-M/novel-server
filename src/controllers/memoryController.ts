import { Request, Response, NextFunction } from 'express';
import supabase from '../config/supabase.js';

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

    res.json({ success: true, message: '已清空会话记忆', data: { deleted: count ?? 0 } });
  } catch (err) {
    next(err);
  }
}; 
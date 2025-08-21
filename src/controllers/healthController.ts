import { Request, Response, NextFunction } from 'express';
import supabase from '../config/supabase.js';

export const dbHealth = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  const startedAt = Date.now();
  try {
    const { data, error } = await supabase
      .from('characters')
      .select('id')
      .limit(1);

    const ms = Date.now() - startedAt;

    if (error) {
      res.status(500).json({
        ok: false,
        latencyMs: ms,
        error: error.message,
        code: (error as any).code ?? undefined
      });
      return;
    }

    res.json({
      ok: true,
      latencyMs: ms,
      sampleCount: data?.length ?? 0
    });
  } catch (err: any) {
    const ms = Date.now() - startedAt;
    res.status(500).json({
      ok: false,
      latencyMs: ms,
      error: err?.message ?? String(err)
    });
  }
}; 
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import supabase, { hasSupabaseConfig } from '../config/supabase.js';
class ChatHistoryService {
    useSupabase = hasSupabaseConfig;
    dataFilePath = join(process.cwd(), 'data', 'chat_history.json');
    async getHistory(sessionId) {
        if (this.useSupabase) {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('role, content, created_at')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });
            if (error)
                throw error;
            return (data || []).map((row) => ({ role: row.role, content: row.content }));
        }
        try {
            if (!existsSync(this.dataFilePath))
                return [];
            const raw = readFileSync(this.dataFilePath, 'utf-8');
            const obj = raw ? JSON.parse(raw) : {};
            const messages = obj[sessionId] || [];
            return messages;
        }
        catch {
            return [];
        }
    }
    async appendMessages(sessionId, messages) {
        if (messages.length === 0)
            return;
        if (this.useSupabase) {
            const rows = messages.map((m) => ({
                session_id: sessionId,
                role: m.role,
                content: m.content,
            }));
            const { error } = await supabase.from('chat_messages').insert(rows);
            if (error)
                throw error;
            return;
        }
        const dir = join(process.cwd(), 'data');
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        let obj = {};
        try {
            if (existsSync(this.dataFilePath)) {
                obj = JSON.parse(readFileSync(this.dataFilePath, 'utf-8') || '{}');
            }
        }
        catch {
            obj = {};
        }
        obj[sessionId] = [...(obj[sessionId] || []), ...messages];
        writeFileSync(this.dataFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    }
    async clearSession(sessionId) {
        if (this.useSupabase) {
            const { error } = await supabase.from('chat_messages').delete().eq('session_id', sessionId);
            if (error)
                throw error;
            return;
        }
        try {
            if (!existsSync(this.dataFilePath))
                return;
            const obj = JSON.parse(readFileSync(this.dataFilePath, 'utf-8') || '{}');
            delete obj[sessionId];
            writeFileSync(this.dataFilePath, JSON.stringify(obj, null, 2), 'utf-8');
        }
        catch { }
    }
}
export default new ChatHistoryService();

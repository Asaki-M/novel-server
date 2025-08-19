import { randomUUID } from 'crypto';
import supabase from '../config/supabase.js';
class CharacterService {
    async listCharacters() {
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return (data || []).map(this.fromRow);
    }
    async createCharacter(request) {
        const now = new Date();
        const row = {
            id: randomUUID(),
            name: request.name,
            avatar: request.avatar ?? null,
            description: request.description,
            system_prompt: request.systemPrompt,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        };
        const { data, error } = await supabase.from('characters').insert(row).select().single();
        if (error)
            throw error;
        return this.fromRow(data);
    }
    async getCharacter(id) {
        const { data, error } = await supabase
            .from('characters')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error)
            throw error;
        return data ? this.fromRow(data) : null;
    }
    async updateCharacter(id, updates) {
        const toUpdate = { updated_at: new Date().toISOString() };
        if (updates.name !== undefined)
            toUpdate.name = updates.name;
        if (updates.avatar !== undefined)
            toUpdate.avatar = updates.avatar;
        if (updates.description !== undefined)
            toUpdate.description = updates.description;
        if (updates.systemPrompt !== undefined)
            toUpdate.system_prompt = updates.systemPrompt;
        const { data, error } = await supabase
            .from('characters')
            .update(toUpdate)
            .eq('id', id)
            .select()
            .maybeSingle();
        if (error)
            throw error;
        return data ? this.fromRow(data) : null;
    }
    async deleteCharacter(id) {
        const { error, count } = await supabase
            .from('characters')
            .delete({ count: 'exact' })
            .eq('id', id);
        if (error)
            throw error;
        return (count || 0) > 0;
    }
    fromRow = (row) => ({
        id: row.id,
        name: row.name,
        avatar: row.avatar || undefined,
        description: row.description,
        systemPrompt: row.system_prompt,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    });
}
export default new CharacterService();

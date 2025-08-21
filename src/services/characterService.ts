import { randomUUID } from 'crypto';
import supabase from '../config/supabase.js';
import { Character, CreateCharacterRequest, UpdateCharacterRequest } from '../types/character.js';

class CharacterService {
  async listCharacters(): Promise<Character[]> {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(this.fromRow);
  }

  async createCharacter(request: CreateCharacterRequest): Promise<Character> {
    const now = new Date();
    const row = {
      id: randomUUID(),
      name: request.name,
      avatar: request.avatar ?? null,
      description: request.description,
      system_prompt: request.systemPrompt,
      backstory_prompt: request.backstoryPrompt ?? null,
      backstory: request.backstory ?? null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    const { data, error } = await supabase.from('characters').insert(row).select().single();
    if (error) throw error;
    return this.fromRow(data);
  }

  async getCharacter(id: string): Promise<Character | null> {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.fromRow(data) : null;
  }

  async updateCharacter(id: string, updates: UpdateCharacterRequest): Promise<Character | null> {
    const toUpdate: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) toUpdate.name = updates.name;
    if (updates.avatar !== undefined) toUpdate.avatar = updates.avatar;
    if (updates.description !== undefined) toUpdate.description = updates.description;
    if (updates.systemPrompt !== undefined) toUpdate.system_prompt = updates.systemPrompt;
    if (updates.backstoryPrompt !== undefined) toUpdate.backstory_prompt = updates.backstoryPrompt;
    if (updates.backstory !== undefined) toUpdate.backstory = updates.backstory;

    const { data, error } = await supabase
      .from('characters')
      .update(toUpdate)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data ? this.fromRow(data) : null;
  }

  async deleteCharacter(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('characters')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    return (count || 0) > 0;
  }

  private fromRow = (row: any): Character => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar || undefined,
    description: row.description,
    systemPrompt: row.system_prompt,
    backstoryPrompt: row.backstory_prompt || undefined,
    backstory: row.backstory || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

export default new CharacterService(); 
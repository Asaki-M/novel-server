export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  backstoryPrompt?: string;
  backstory?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterRequest {
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  backstoryPrompt?: string;
  backstory?: string;
}

export interface UpdateCharacterRequest {
  name?: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
  backstoryPrompt?: string;
  backstory?: string;
} 
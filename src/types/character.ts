export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterRequest {
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
}

export interface UpdateCharacterRequest {
  name?: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
} 
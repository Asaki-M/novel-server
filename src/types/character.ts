export interface Character {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  personality: string[];
  tags: string[];
  category: 'novel' | 'roleplay' | 'assistant' | 'custom';
  isBuiltIn: boolean;
  isPublic: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  rating?: number;
  examples?: ChatExample[];
}

export interface ChatExample {
  user: string;
  assistant: string;
}

export interface CreateCharacterRequest {
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  personality: string[];
  tags: string[];
  category: 'novel' | 'roleplay' | 'assistant' | 'custom';
  isPublic?: boolean;
  examples?: ChatExample[];
}

export interface UpdateCharacterRequest {
  name?: string;
  avatar?: string;
  description?: string;
  systemPrompt?: string;
  personality?: string[];
  tags?: string[];
  category?: 'novel' | 'roleplay' | 'assistant' | 'custom';
  isPublic?: boolean;
  examples?: ChatExample[];
}

export interface CharacterListItem {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  personality: string[];
  tags: string[];
  category: string;
  isBuiltIn: boolean;
  usageCount: number;
  rating?: number;
}

export interface CharacterSearchQuery {
  category?: string;
  tags?: string[];
  keyword?: string;
  page?: number;
  limit?: number;
  sortBy?: 'popular' | 'newest' | 'rating' | 'name';
} 
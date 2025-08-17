export interface MemoryChunk {
  id: string;
  sessionId: string;
  chunkIndex: number;
  content: string;
  summary: string;           // AI生成的总结
  embedding: number[];       // 向量嵌入
  messageCount: number;      // 包含的消息数量
  characters: string[];      // 涉及的角色
  keywords: string[];        // 关键词
  importance: number;        // 重要性评分 0-1
  createdAt: Date;
  metadata: {
    startMessageId?: string;
    endMessageId?: string;
    genre?: string;
    emotion?: string;        // 情感色彩
    plotPoint?: string;      // 剧情要点类型：开端、发展、高潮、结局
  };
}

export interface SessionInfo {
  id: string;
  title: string;
  description?: string;
  genre?: string;
  tags: string[];
  characters: string[];     // 主要角色列表
  plotOutline: string;      // 故事大纲
  currentChunk: number;     // 当前块索引
  totalChunks: number;      // 总块数
  totalMessages: number;
  totalTokens: number;
  lastSummary?: string;     // 最新的故事状态总结
  createdAt: Date;
  updatedAt: Date;
}

export interface RetrievalContext {
  recentChunks: MemoryChunk[];      // 最近的记忆块
  relevantChunks: MemoryChunk[];    // 相关的记忆块
  plotSummary: string;              // 当前剧情总结
  characters: string[];             // 活跃角色
  worldState: string;               // 世界状态描述
}

export interface ChatWithVectorMemoryRequest {
  sessionId: string;
  message: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  chunkThreshold?: number;   // 多少条消息触发总结
  retrievalCount?: number;   // 检索多少个相关块
}

export interface MemoryAnalysis {
  shouldCreateChunk: boolean;
  importance: number;
  plotPoint?: string;
  emotion?: string;
  newCharacters: string[];
  keywords: string[];
}

export interface VectorSearchQuery {
  query: string;
  sessionId: string;
  topK?: number;
  minSimilarity?: number;
  filters?: {
    importance?: number;
    plotPoint?: string;
    characters?: string[];
  };
} 
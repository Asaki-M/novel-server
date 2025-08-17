import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import databaseConfig from '../config/database.js';
import { MemoryChunk, VectorSearchQuery } from '../types/vectorMemory.js';

export interface VectorDatabase {
  upsert(chunk: MemoryChunk): Promise<void>;
  search(query: VectorSearchQuery, embedding: number[]): Promise<MemoryChunk[]>;
  delete(chunkId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
}

// Supabase 实现 (推荐用于 Vercel)
class SupabaseVectorDB implements VectorDatabase {
  private client;

  constructor() {
    this.client = createClient(
      databaseConfig.supabase!.url,
      databaseConfig.supabase!.key
    );
  }

  async upsert(chunk: MemoryChunk): Promise<void> {
    const { error } = await this.client
      .from('memory_chunks')
      .upsert({
        id: chunk.id,
        session_id: chunk.sessionId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        summary: chunk.summary,
        embedding: chunk.embedding,
        message_count: chunk.messageCount,
        characters: chunk.characters,
        keywords: chunk.keywords,
        importance: chunk.importance,
        created_at: chunk.createdAt.toISOString(),
        metadata: chunk.metadata,
      });

    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  async search(query: VectorSearchQuery, embedding: number[]): Promise<MemoryChunk[]> {
    // 使用 Supabase 的向量相似度搜索
    const { data, error } = await this.client.rpc('search_memory_chunks', {
      query_embedding: embedding,
      session_id: query.sessionId,
      similarity_threshold: query.minSimilarity || 0.7,
      match_count: query.topK || 5,
    });

    if (error) throw new Error(`Supabase search failed: ${error.message}`);

    return data.map((item: any) => ({
      id: item.id,
      sessionId: item.session_id,
      chunkIndex: item.chunk_index,
      content: item.content,
      summary: item.summary,
      embedding: item.embedding,
      messageCount: item.message_count,
      characters: item.characters,
      keywords: item.keywords,
      importance: item.importance,
      createdAt: new Date(item.created_at),
      metadata: item.metadata,
    }));
  }

  async delete(chunkId: string): Promise<void> {
    const { error } = await this.client
      .from('memory_chunks')
      .delete()
      .eq('id', chunkId);

    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('memory_chunks')
      .delete()
      .eq('session_id', sessionId);

    if (error) throw new Error(`Supabase delete session failed: ${error.message}`);
  }
}

// Pinecone 实现 (备选方案)
class PineconeVectorDB implements VectorDatabase {
  private client: Pinecone;
  private index: any;

  constructor() {
    this.client = new Pinecone({
      apiKey: databaseConfig.pinecone!.apiKey,
    });
    this.index = this.client.index(databaseConfig.pinecone!.indexName);
  }

  async upsert(chunk: MemoryChunk): Promise<void> {
    await this.index.upsert([{
      id: chunk.id,
      values: chunk.embedding,
      metadata: {
        sessionId: chunk.sessionId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        summary: chunk.summary,
        messageCount: chunk.messageCount,
        characters: chunk.characters,
        keywords: chunk.keywords,
        importance: chunk.importance,
        createdAt: chunk.createdAt.toISOString(),
        ...chunk.metadata,
      },
    }]);
  }

  async search(query: VectorSearchQuery, embedding: number[]): Promise<MemoryChunk[]> {
    const result = await this.index.query({
      vector: embedding,
      topK: query.topK || 5,
      filter: { sessionId: query.sessionId },
      includeMetadata: true,
    });

    return result.matches.map((match: any) => ({
      id: match.id,
      sessionId: match.metadata.sessionId,
      chunkIndex: match.metadata.chunkIndex,
      content: match.metadata.content,
      summary: match.metadata.summary,
      embedding: [], // Pinecone不返回原始向量
      messageCount: match.metadata.messageCount,
      characters: match.metadata.characters,
      keywords: match.metadata.keywords,
      importance: match.metadata.importance,
      createdAt: new Date(match.metadata.createdAt),
      metadata: {
        genre: match.metadata.genre,
        emotion: match.metadata.emotion,
        plotPoint: match.metadata.plotPoint,
      },
    }));
  }

  async delete(chunkId: string): Promise<void> {
    await this.index.deleteOne(chunkId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.index.deleteMany({ sessionId });
  }
}

// 内存实现 (开发环境)
class MemoryVectorDB implements VectorDatabase {
  private chunks: Map<string, MemoryChunk> = new Map();

  async upsert(chunk: MemoryChunk): Promise<void> {
    this.chunks.set(chunk.id, chunk);
  }

  async search(query: VectorSearchQuery, embedding: number[]): Promise<MemoryChunk[]> {
    const sessionChunks = Array.from(this.chunks.values())
      .filter(chunk => chunk.sessionId === query.sessionId);

    // 简单的余弦相似度计算
    const similarities = sessionChunks.map(chunk => ({
      chunk,
      similarity: this.cosineSimilarity(embedding, chunk.embedding),
    }));

    return similarities
      .filter(item => item.similarity >= (query.minSimilarity || 0.7))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, query.topK || 5)
      .map(item => item.chunk);
  }

  async delete(chunkId: string): Promise<void> {
    this.chunks.delete(chunkId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.sessionId === sessionId) {
        this.chunks.delete(id);
      }
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// 工厂函数
export function createVectorDatabase(): VectorDatabase {
  switch (databaseConfig.type) {
    case 'supabase':
      return new SupabaseVectorDB();
    case 'pinecone':
      return new PineconeVectorDB();
    case 'memory':
    default:
      return new MemoryVectorDB();
  }
} 
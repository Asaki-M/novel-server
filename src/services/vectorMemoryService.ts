import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { createVectorDatabase } from './vectorDatabase.js';
import config from '../config/index.js';
import databaseConfig from '../config/database.js';
import {
  MemoryChunk,
  SessionInfo,
  RetrievalContext,
  MemoryAnalysis,
  VectorSearchQuery,
} from '../types/vectorMemory.js';
import { ChatMessage } from '../types/chat.js';

class VectorMemoryService {
  private vectorDB = createVectorDatabase();
  private openai: OpenAI;
  private sessions: Map<string, SessionInfo> = new Map();
  private pendingMessages: Map<string, ChatMessage[]> = new Map(); // 等待总结的消息

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openrouter.apiKey,
      baseURL: config.openrouter.baseUrl,
    });
  }

  /**
   * 创建新会话
   */
  async createSession(request: {
    title: string;
    description?: string;
    genre?: string;
    tags?: string[];
    systemMessage?: string;
  }): Promise<SessionInfo> {
    const sessionId = randomUUID();
    const now = new Date();

    const session: SessionInfo = {
      id: sessionId,
      title: request.title,
      description: request.description,
      genre: request.genre,
      tags: request.tags || [],
      characters: [],
      plotOutline: request.description || '',
      currentChunk: 0,
      totalChunks: 0,
      totalMessages: 0,
      totalTokens: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.pendingMessages.set(sessionId, []);

    // 如果有系统消息，创建初始记忆块
    if (request.systemMessage) {
      await this.createInitialChunk(sessionId, request.systemMessage);
    }

    return session;
  }

  /**
   * 添加消息并智能处理
   */
  async addMessage(
    sessionId: string,
    message: ChatMessage,
    chunkThreshold: number = 8
  ): Promise<MemoryAnalysis> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const pending = this.pendingMessages.get(sessionId) || [];
    pending.push(message);

    session.totalMessages++;
    session.updatedAt = new Date();

    // 分析消息内容
    const analysis = await this.analyzeMessage(pending, session);

    // 决定是否创建记忆块
    if (pending.length >= chunkThreshold || analysis.shouldCreateChunk) {
      await this.createMemoryChunk(sessionId, pending, analysis);
      this.pendingMessages.set(sessionId, []); // 清空待处理消息
    } else {
      this.pendingMessages.set(sessionId, pending);
    }

    return analysis;
  }

  /**
   * 检索相关记忆
   */
  async retrieveRelevantMemory(
    sessionId: string,
    query: string,
    retrievalCount: number = 5
  ): Promise<RetrievalContext> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // 1. 生成查询向量
    const queryEmbedding = await this.generateEmbedding(query);

    // 2. 向量搜索
    const searchQuery: VectorSearchQuery = {
      query,
      sessionId,
      topK: retrievalCount,
      minSimilarity: 0.7,
    };

    const relevantChunks = await this.vectorDB.search(searchQuery, queryEmbedding);

    // 3. 获取最近的记忆块
    const recentChunks = await this.getRecentChunks(sessionId, 2);

    // 4. 生成当前剧情总结
    const plotSummary = await this.generatePlotSummary(relevantChunks, recentChunks);

    // 5. 提取活跃角色
    const activeCharacters = this.extractActiveCharacters(relevantChunks, recentChunks);

    return {
      recentChunks,
      relevantChunks,
      plotSummary,
      characters: activeCharacters,
      worldState: session.lastSummary || '',
    };
  }

  /**
   * 生成向量嵌入
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: databaseConfig.embedding.model,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * 分析消息内容
   */
  private async analyzeMessage(
    messages: ChatMessage[],
    session: SessionInfo
  ): Promise<MemoryAnalysis> {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `
作为小说创作助手，分析以下对话内容，判断是否应该创建记忆块：

对话内容：
${conversationText}

当前故事类型：${session.genre || '未知'}
已知角色：${session.characters.join(', ') || '无'}

请分析：
1. 重要性评分 (0-1)
2. 是否应该创建记忆块 (true/false)
3. 剧情要点类型 (开端/发展/冲突/高潮/结局/转折)
4. 情感色彩 (积极/消极/中性/紧张/浪漫/悲伤/惊喜)
5. 新出现的角色名称
6. 关键词 (最多5个)

以JSON格式回答：
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openrouter.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      return {
        shouldCreateChunk: analysis.shouldCreateChunk || messages.length >= 6,
        importance: Math.max(0, Math.min(1, analysis.importance || 0.5)),
        plotPoint: analysis.plotPoint,
        emotion: analysis.emotion,
        newCharacters: analysis.newCharacters || [],
        keywords: analysis.keywords || [],
      };
    } catch (error) {
      // 失败时使用默认规则
      return {
        shouldCreateChunk: messages.length >= 8,
        importance: 0.5,
        plotPoint: '发展',
        emotion: '中性',
        newCharacters: [],
        keywords: [],
      };
    }
  }

  /**
   * 创建记忆块
   */
  private async createMemoryChunk(
    sessionId: string,
    messages: ChatMessage[],
    analysis: MemoryAnalysis
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;
    
    // 生成内容和总结
    const content = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summary = await this.generateSummary(content, session);
    const embedding = await this.generateEmbedding(summary);

    const chunk: MemoryChunk = {
      id: randomUUID(),
      sessionId,
      chunkIndex: session.totalChunks,
      content,
      summary,
      embedding,
      messageCount: messages.length,
      characters: [...session.characters, ...analysis.newCharacters],
      keywords: analysis.keywords,
      importance: analysis.importance,
      createdAt: new Date(),
      metadata: {
        genre: session.genre,
        emotion: analysis.emotion,
        plotPoint: analysis.plotPoint,
      },
    };

    // 存储到向量数据库
    await this.vectorDB.upsert(chunk);

    // 更新会话信息
    session.totalChunks++;
    session.currentChunk = session.totalChunks - 1;
    session.characters = Array.from(new Set([...session.characters, ...analysis.newCharacters]));
    session.lastSummary = summary;
  }

  /**
   * 创建初始记忆块
   */
  private async createInitialChunk(sessionId: string, systemMessage: string): Promise<void> {
    const session = this.sessions.get(sessionId)!;
    const embedding = await this.generateEmbedding(systemMessage);

    const chunk: MemoryChunk = {
      id: randomUUID(),
      sessionId,
      chunkIndex: 0,
      content: `system: ${systemMessage}`,
      summary: `故事设定：${systemMessage}`,
      embedding,
      messageCount: 1,
      characters: [],
      keywords: ['设定', '背景'],
      importance: 0.9, // 系统消息很重要
      createdAt: new Date(),
      metadata: {
        genre: session.genre,
        plotPoint: '开端',
      },
    };

    await this.vectorDB.upsert(chunk);
    session.totalChunks = 1;
  }

  /**
   * 生成总结
   */
  private async generateSummary(content: string, session: SessionInfo): Promise<string> {
    const prompt = `
请为以下${session.genre || ''}小说对话生成简洁总结 (50字以内)：

对话内容：
${content}

故事背景：${session.description || ''}
已知角色：${session.characters.join(', ') || '无'}

总结要点：
1. 主要事件
2. 角色动作/对话
3. 情节发展

总结：
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openrouter.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0]?.message?.content || '对话记录';
    } catch (error) {
      return `${session.title} - 对话记录 ${new Date().toLocaleString()}`;
    }
  }

  /**
   * 获取最近的记忆块
   */
  private async getRecentChunks(sessionId: string, count: number): Promise<MemoryChunk[]> {
    // 这里简化实现，实际应该从数据库按时间查询
    const query: VectorSearchQuery = {
      query: '',
      sessionId,
      topK: count,
    };
    
    return await this.vectorDB.search(query, []);
  }

  /**
   * 生成剧情总结
   */
  private async generatePlotSummary(
    relevantChunks: MemoryChunk[],
    recentChunks: MemoryChunk[]
  ): Promise<string> {
    const allChunks = [...recentChunks, ...relevantChunks];
    const summaries = allChunks.map(chunk => chunk.summary).join(' ');

    if (!summaries) return '故事刚刚开始';

    const prompt = `
基于以下情节片段，生成当前故事状态总结 (100字以内)：

${summaries}

总结当前：
1. 故事进展到哪里
2. 主要角色状态
3. 当前场景/环境

总结：
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: config.openrouter.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content || '故事正在进行中';
    } catch (error) {
      return '故事正在进行中';
    }
  }

  /**
   * 提取活跃角色
   */
  private extractActiveCharacters(
    relevantChunks: MemoryChunk[],
    recentChunks: MemoryChunk[]
  ): string[] {
    const allCharacters = new Set<string>();
    
    [...recentChunks, ...relevantChunks].forEach(chunk => {
      chunk.characters.forEach(char => allCharacters.add(char));
    });

    return Array.from(allCharacters).slice(0, 10); // 最多10个活跃角色
  }

  /**
   * 获取会话信息
   */
  getSession(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    await this.vectorDB.deleteSession(sessionId);
    this.sessions.delete(sessionId);
    this.pendingMessages.delete(sessionId);
    return true;
  }
}

export default new VectorMemoryService(); 
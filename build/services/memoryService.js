import { randomUUID } from 'crypto';
class MemoryService {
    sessions = new Map();
    MAX_MESSAGES_PER_SESSION = 1000; // 每个会话最大消息数
    MAX_CONTEXT_MESSAGES = 50; // 发送给AI的最大上下文消息数
    /**
     * 创建新的会话
     */
    createSession(request) {
        const sessionId = randomUUID();
        const now = new Date();
        const session = {
            id: sessionId,
            title: request.title,
            description: request.description,
            createdAt: now,
            updatedAt: now,
            messages: [],
            metadata: {
                messageCount: 0,
                totalTokens: 0,
                tags: request.tags || [],
                genre: request.genre,
                characters: []
            }
        };
        // 如果提供了系统消息，添加到会话开始
        if (request.systemMessage) {
            session.messages.push({
                role: 'system',
                content: request.systemMessage
            });
            session.metadata.messageCount = 1;
        }
        this.sessions.set(sessionId, session);
        return session;
    }
    /**
     * 获取会话
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    /**
     * 更新会话信息
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        if (updates.title !== undefined)
            session.title = updates.title;
        if (updates.description !== undefined)
            session.description = updates.description;
        if (updates.tags !== undefined)
            session.metadata.tags = updates.tags;
        if (updates.genre !== undefined)
            session.metadata.genre = updates.genre;
        if (updates.characters !== undefined)
            session.metadata.characters = updates.characters;
        session.updatedAt = new Date();
        return session;
    }
    /**
     * 删除会话
     */
    deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
    /**
     * 添加消息到会话
     */
    addMessage(sessionId, message, tokenUsage) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return null;
        // 检查消息数量限制
        if (session.messages.length >= this.MAX_MESSAGES_PER_SESSION) {
            // 移除最旧的非系统消息
            const firstNonSystemIndex = session.messages.findIndex(msg => msg.role !== 'system');
            if (firstNonSystemIndex !== -1) {
                session.messages.splice(firstNonSystemIndex, 1);
                session.metadata.messageCount--;
            }
        }
        session.messages.push(message);
        session.metadata.messageCount++;
        session.updatedAt = new Date();
        if (tokenUsage) {
            session.metadata.totalTokens += tokenUsage;
        }
        // 自动提取角色名称（简单实现）
        if (message.role === 'user' || message.role === 'assistant') {
            this.extractCharacters(session, message.content);
        }
        return session;
    }
    /**
     * 获取会话的上下文消息（用于发送给AI）
     */
    getContextMessages(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return [];
        const messages = session.messages;
        // 如果消息数量不超过限制，返回全部
        if (messages.length <= this.MAX_CONTEXT_MESSAGES) {
            return [...messages];
        }
        // 保留系统消息和最近的对话
        const systemMessages = messages.filter(msg => msg.role === 'system');
        const recentMessages = messages
            .filter(msg => msg.role !== 'system')
            .slice(-(this.MAX_CONTEXT_MESSAGES - systemMessages.length));
        return [...systemMessages, ...recentMessages];
    }
    /**
     * 获取所有会话的摘要
     */
    getAllSessionSummaries() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            title: session.title,
            description: session.description,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.metadata.messageCount,
            totalTokens: session.metadata.totalTokens,
            tags: session.metadata.tags,
            genre: session.metadata.genre,
            lastMessage: session.messages.length > 0
                ? session.messages[session.messages.length - 1].content.substring(0, 100) + '...'
                : undefined
        })).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    /**
     * 搜索会话
     */
    searchSessions(query, genre, tags) {
        const allSessions = this.getAllSessionSummaries();
        return allSessions.filter(session => {
            // 文本搜索
            const textMatch = !query ||
                session.title.toLowerCase().includes(query.toLowerCase()) ||
                session.description?.toLowerCase().includes(query.toLowerCase()) ||
                session.lastMessage?.toLowerCase().includes(query.toLowerCase());
            // 类型筛选
            const genreMatch = !genre || session.genre === genre;
            // 标签筛选
            const tagsMatch = !tags || tags.length === 0 ||
                tags.some(tag => session.tags.includes(tag));
            return textMatch && genreMatch && tagsMatch;
        });
    }
    /**
     * 获取记忆库统计信息
     */
    getStats() {
        const sessions = Array.from(this.sessions.values());
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // 统计类型分布
        const genreCount = {};
        const tagCount = {};
        let activeSessionsLast24h = 0;
        sessions.forEach(session => {
            // 统计活跃会话
            if (session.updatedAt > yesterday) {
                activeSessionsLast24h++;
            }
            // 统计类型
            if (session.metadata.genre) {
                genreCount[session.metadata.genre] = (genreCount[session.metadata.genre] || 0) + 1;
            }
            // 统计标签
            session.metadata.tags.forEach(tag => {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
        });
        return {
            totalSessions: sessions.length,
            totalMessages: sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
            totalTokens: sessions.reduce((sum, s) => sum + s.metadata.totalTokens, 0),
            activeSessionsLast24h,
            popularGenres: Object.entries(genreCount)
                .map(([genre, count]) => ({ genre, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            popularTags: Object.entries(tagCount)
                .map(([tag, count]) => ({ tag, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 20)
        };
    }
    /**
     * 清理旧会话（保留最近更新的会话）
     */
    cleanupOldSessions(keepCount = 100) {
        const sessions = Array.from(this.sessions.entries())
            .sort(([, a], [, b]) => b.updatedAt.getTime() - a.updatedAt.getTime());
        if (sessions.length <= keepCount)
            return 0;
        const toDelete = sessions.slice(keepCount);
        toDelete.forEach(([sessionId]) => {
            this.sessions.delete(sessionId);
        });
        return toDelete.length;
    }
    /**
     * 导出会话数据
     */
    exportSession(sessionId) {
        return this.getSession(sessionId);
    }
    /**
     * 导入会话数据
     */
    importSession(sessionData) {
        try {
            this.sessions.set(sessionData.id, {
                ...sessionData,
                createdAt: new Date(sessionData.createdAt),
                updatedAt: new Date(sessionData.updatedAt)
            });
            return true;
        }
        catch (error) {
            console.error('导入会话失败:', error);
            return false;
        }
    }
    /**
     * 私有方法：从消息内容中提取角色名称
     */
    extractCharacters(session, content) {
        // 简单的角色名称提取逻辑（可以后续优化）
        const patterns = [
            /["""]([^"""]{2,10})["""]说/g, // "角色名"说
            /^([^：：]{2,8})[：：]/gm, // 角色名：
            /([^，。！？；]{2,8})(?:说道|说|道)/g // 角色名说道
        ];
        const characters = new Set(session.metadata.characters || []);
        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const name = match[1].trim();
                if (name.length >= 2 && name.length <= 8 && !/[0-9]/.test(name)) {
                    characters.add(name);
                }
            }
        });
        session.metadata.characters = Array.from(characters);
    }
}
export default new MemoryService();

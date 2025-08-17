import memoryService from '../services/memoryService.js';
import openaiService from '../services/openaiService.js';
/**
 * 创建新的会话
 */
export const createSession = async (req, res, next) => {
    try {
        const requestData = req.body;
        // 验证必填字段
        if (!requestData.title || requestData.title.trim().length === 0) {
            const response = {
                success: false,
                error: '会话标题不能为空'
            };
            res.status(400).json(response);
            return;
        }
        const session = memoryService.createSession(requestData);
        const response = {
            success: true,
            message: '会话创建成功',
            data: session
        };
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取会话详情
 */
export const getSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const session = memoryService.getSession(sessionId);
        if (!session) {
            const response = {
                success: false,
                error: '会话不存在'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            data: session
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 更新会话信息
 */
export const updateSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const updates = req.body;
        const session = memoryService.updateSession(sessionId, updates);
        if (!session) {
            const response = {
                success: false,
                error: '会话不存在'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            message: '会话更新成功',
            data: session
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 删除会话
 */
export const deleteSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const deleted = memoryService.deleteSession(sessionId);
        if (!deleted) {
            const response = {
                success: false,
                error: '会话不存在'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            message: '会话删除成功'
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取所有会话摘要
 */
export const getAllSessions = async (req, res, next) => {
    try {
        const sessions = memoryService.getAllSessionSummaries();
        const response = {
            success: true,
            data: sessions
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 搜索会话
 */
export const searchSessions = async (req, res, next) => {
    try {
        const { q: query, genre, tags } = req.query;
        const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;
        const sessions = memoryService.searchSessions(query || '', genre, tagsArray);
        const response = {
            success: true,
            data: sessions
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 带记忆的聊天
 */
export const chatWithMemory = async (req, res, next) => {
    try {
        const { sessionId, message, temperature, max_tokens, stream, saveToHistory = true } = req.body;
        // 验证必填字段
        if (!sessionId || !message || message.trim().length === 0) {
            const response = {
                success: false,
                error: '会话ID和消息内容不能为空'
            };
            res.status(400).json(response);
            return;
        }
        // 检查会话是否存在
        const session = memoryService.getSession(sessionId);
        if (!session) {
            const response = {
                success: false,
                error: '会话不存在'
            };
            res.status(404).json(response);
            return;
        }
        // 获取上下文消息
        const contextMessages = memoryService.getContextMessages(sessionId);
        // 添加用户消息到上下文
        const userMessage = { role: 'user', content: message };
        const messagesForAI = [...contextMessages, userMessage];
        // 如果需要保存到历史记录，先保存用户消息
        if (saveToHistory) {
            memoryService.addMessage(sessionId, userMessage);
        }
        // 调用AI
        const completion = stream
            ? await openaiService.createChatCompletion(messagesForAI, {
                temperature,
                max_tokens,
                stream: true
            })
            : await openaiService.createChatCompletion(messagesForAI, {
                temperature,
                max_tokens,
                stream: false
            });
        if (stream) {
            // 流式响应
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            let fullResponse = '';
            for await (const chunk of completion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            }
            // 保存AI回复到历史记录
            if (saveToHistory && fullResponse) {
                const assistantMessage = { role: 'assistant', content: fullResponse };
                memoryService.addMessage(sessionId, assistantMessage);
            }
            res.write('data: [DONE]\n\n');
            res.end();
        }
        else {
            // 常规响应
            const aiResponse = completion.choices[0]?.message?.content || '';
            // 保存AI回复到历史记录
            if (saveToHistory && aiResponse) {
                const assistantMessage = { role: 'assistant', content: aiResponse };
                const tokenUsage = completion.usage?.total_tokens || 0;
                memoryService.addMessage(sessionId, assistantMessage, tokenUsage);
            }
            const response = {
                success: true,
                message: '聊天响应成功',
                data: {
                    response: aiResponse,
                    sessionId: sessionId,
                    usage: completion.usage ? {
                        prompt_tokens: completion.usage.prompt_tokens,
                        completion_tokens: completion.usage.completion_tokens,
                        total_tokens: completion.usage.total_tokens
                    } : undefined
                }
            };
            res.json(response);
        }
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取记忆库统计信息
 */
export const getMemoryStats = async (req, res, next) => {
    try {
        const stats = memoryService.getStats();
        const response = {
            success: true,
            data: stats
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 清理旧会话
 */
export const cleanupSessions = async (req, res, next) => {
    try {
        const { keepCount = 100 } = req.body;
        const deletedCount = memoryService.cleanupOldSessions(keepCount);
        const response = {
            success: true,
            message: `清理完成，删除了 ${deletedCount} 个旧会话`,
            data: { deletedCount }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 导出会话
 */
export const exportSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const session = memoryService.exportSession(sessionId);
        if (!session) {
            const response = {
                success: false,
                error: '会话不存在'
            };
            res.status(404).json(response);
            return;
        }
        // 设置下载头
        res.setHeader('Content-Disposition', `attachment; filename="session-${sessionId}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(session);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 导入会话
 */
export const importSession = async (req, res, next) => {
    try {
        const sessionData = req.body;
        const success = memoryService.importSession(sessionData);
        if (!success) {
            const response = {
                success: false,
                error: '会话数据格式不正确'
            };
            res.status(400).json(response);
            return;
        }
        const response = {
            success: true,
            message: '会话导入成功',
            data: { sessionId: sessionData.id }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};

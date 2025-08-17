import openaiService from '../services/openaiService.js';
import vectorMemoryService from '../services/vectorMemoryService.js';
import characterService from '../services/characterService.js';
import config from '../config/index.js';
export const chat = async (req, res, next) => {
    try {
        const { messages, temperature, max_tokens, stream, sessionId, // 可选：如果提供则使用向量记忆
        useMemory = false, // 是否启用记忆功能
        characterId // 可选：角色卡ID
         } = req.body;
        // 验证基本参数
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            const response = {
                success: false,
                error: '请提供有效的消息数组'
            };
            res.status(400).json(response);
            return;
        }
        let messagesForAI = messages;
        let memoryContext = undefined;
        let characterInfo = undefined;
        // 处理角色卡
        if (characterId) {
            const character = characterService.getCharacter(characterId);
            if (character) {
                // 增加使用次数
                characterService.incrementUsage(characterId);
                // 将角色的system prompt插入到消息开头
                const systemMessage = { role: 'system', content: character.systemPrompt };
                messagesForAI = [systemMessage, ...messages];
                characterInfo = {
                    id: character.id,
                    name: character.name,
                    avatar: character.avatar,
                    category: character.category,
                };
                console.log('🎭 使用角色卡:', character.name);
            }
            else {
                console.warn('角色卡不存在:', characterId);
            }
        }
        // 如果启用记忆功能且提供了sessionId
        if (useMemory && sessionId && config.features.vectorMemory) {
            try {
                // 获取最后一条用户消息
                const lastUserMessage = messages[messages.length - 1];
                if (lastUserMessage.role === 'user') {
                    // 1. 添加到记忆库 (可能触发智能总结)
                    await vectorMemoryService.addMessage(sessionId, lastUserMessage);
                    // 2. 检索相关记忆
                    const context = await vectorMemoryService.retrieveRelevantMemory(sessionId, lastUserMessage.content, 5 // 检索5个相关记忆块
                    );
                    // 3. 构建带记忆的上下文
                    const session = vectorMemoryService.getSession(sessionId);
                    if (session && context.relevantChunks.length > 0) {
                        const contextPrompt = buildContextPrompt(context, session);
                        // 如果已有角色卡，需要合并system prompt
                        if (characterId && characterInfo) {
                            const character = characterService.getCharacter(characterId);
                            const combinedPrompt = `${character?.systemPrompt || ''}\n\n---\n\n${contextPrompt}`;
                            messagesForAI = [
                                { role: 'system', content: combinedPrompt },
                                lastUserMessage
                            ];
                        }
                        else {
                            messagesForAI = [
                                { role: 'system', content: contextPrompt },
                                lastUserMessage // 只发送当前消息，上下文已在system prompt中
                            ];
                        }
                        memoryContext = {
                            relevantChunks: context.relevantChunks.length,
                            plotSummary: context.plotSummary,
                            activeCharacters: context.characters,
                        };
                        console.log('🧠 启用记忆模式，检索到', context.relevantChunks.length, '个相关记忆块');
                    }
                }
            }
            catch (memoryError) {
                console.warn('记忆功能出错，降级为普通模式:', memoryError);
                // 记忆功能失败不影响基本聊天，继续使用原始消息
            }
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
            // 流式响应处理
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
            // 如果启用记忆，保存AI回复
            if (useMemory && sessionId && fullResponse) {
                try {
                    const assistantMessage = { role: 'assistant', content: fullResponse };
                    await vectorMemoryService.addMessage(sessionId, assistantMessage);
                }
                catch (error) {
                    console.warn('保存AI回复到记忆库失败:', error);
                }
            }
            res.write('data: [DONE]\n\n');
            res.end();
        }
        else {
            // 常规响应
            const response = completion.choices[0]?.message?.content || '';
            // 如果启用记忆，保存AI回复
            if (useMemory && sessionId && response) {
                try {
                    const assistantMessage = { role: 'assistant', content: response };
                    await vectorMemoryService.addMessage(sessionId, assistantMessage);
                }
                catch (error) {
                    console.warn('保存AI回复到记忆库失败:', error);
                }
            }
            const result = {
                success: true,
                message: characterInfo
                    ? `${characterInfo.name} 回复成功`
                    : useMemory ? '智能记忆聊天响应成功' : '聊天响应成功',
                data: {
                    response: response,
                    character: characterInfo, // 返回使用的角色信息
                    memoryContext, // 如果启用记忆，返回记忆上下文信息
                    usage: completion.usage ? {
                        prompt_tokens: completion.usage.prompt_tokens,
                        completion_tokens: completion.usage.completion_tokens,
                        total_tokens: completion.usage.total_tokens
                    } : undefined
                }
            };
            res.json(result);
        }
    }
    catch (error) {
        next(error);
    }
};
export const getModels = async (req, res, next) => {
    try {
        const models = await openaiService.getModels();
        const response = {
            success: true,
            data: models.data.filter(model => model.id.includes('qwen'))
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 创建记忆会话 (集成到聊天模块)
 */
export const createSession = async (req, res, next) => {
    try {
        const { title, description, genre, tags, systemMessage } = req.body;
        if (!title || title.trim().length === 0) {
            const response = {
                success: false,
                error: '会话标题不能为空'
            };
            res.status(400).json(response);
            return;
        }
        const session = await vectorMemoryService.createSession({
            title,
            description,
            genre,
            tags,
            systemMessage,
        });
        const response = {
            success: true,
            message: '记忆会话创建成功',
            data: session
        };
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取会话信息
 */
export const getSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const session = vectorMemoryService.getSession(sessionId);
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
 * 删除会话
 */
export const deleteSession = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const deleted = await vectorMemoryService.deleteSession(sessionId);
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
// ==================== 角色卡管理 ====================
/**
 * 获取角色卡列表
 */
export const getCharacters = async (req, res, next) => {
    try {
        const query = {
            category: req.query.category,
            tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : undefined,
            keyword: req.query.keyword,
            page: req.query.page ? parseInt(req.query.page) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            sortBy: req.query.sortBy,
        };
        const result = characterService.searchCharacters(query);
        const response = {
            success: true,
            data: result
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取角色卡详情
 */
export const getCharacter = async (req, res, next) => {
    try {
        const { characterId } = req.params;
        const character = characterService.getCharacter(characterId);
        if (!character) {
            const response = {
                success: false,
                error: '角色卡不存在'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            data: character
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 创建角色卡
 */
export const createCharacter = async (req, res, next) => {
    try {
        const characterData = req.body;
        // 验证必填字段
        if (!characterData.name || !characterData.description || !characterData.systemPrompt) {
            const response = {
                success: false,
                error: '角色名称、描述和系统提示词为必填项'
            };
            res.status(400).json(response);
            return;
        }
        const character = characterService.createCharacter(characterData);
        const response = {
            success: true,
            message: '角色卡创建成功',
            data: character
        };
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 更新角色卡
 */
export const updateCharacter = async (req, res, next) => {
    try {
        const { characterId } = req.params;
        const updates = req.body;
        const character = characterService.updateCharacter(characterId, updates);
        if (!character) {
            const response = {
                success: false,
                error: '角色卡不存在或无法修改内置角色'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            message: '角色卡更新成功',
            data: character
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 删除角色卡
 */
export const deleteCharacter = async (req, res, next) => {
    try {
        const { characterId } = req.params;
        const deleted = characterService.deleteCharacter(characterId);
        if (!deleted) {
            const response = {
                success: false,
                error: '角色卡不存在或无法删除内置角色'
            };
            res.status(404).json(response);
            return;
        }
        const response = {
            success: true,
            message: '角色卡删除成功'
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 获取角色卡统计信息
 */
export const getCharacterStats = async (req, res, next) => {
    try {
        const categoryStats = characterService.getCategoryStats();
        const popularTags = characterService.getPopularTags(10);
        const response = {
            success: true,
            data: {
                categoryStats,
                popularTags
            }
        };
        res.json(response);
    }
    catch (error) {
        next(error);
    }
};
/**
 * 构建包含记忆上下文的提示 (内部函数)
 */
function buildContextPrompt(context, session) {
    const { plotSummary, characters, relevantChunks } = context;
    let prompt = `你是专业的${session.genre || ''}小说创作助手。

## 当前故事状态
${plotSummary}

## 活跃角色
${characters.length > 0 ? characters.join('、') : '暂无'}

## 相关记忆片段
${relevantChunks.map((chunk, index) => `${index + 1}. ${chunk.summary} (重要性: ${chunk.importance.toFixed(2)})`).join('\n')}

## 创作原则
- 保持故事连贯性，参考上述记忆
- 角色性格前后一致
- 符合${session.genre || ''}类型特点
- 确保与已有剧情无缝衔接

请基于用户要求继续创作：`;
    return prompt;
}

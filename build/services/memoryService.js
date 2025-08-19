import langchain from './langchainService.js';
import history from './chatHistoryService.js';
import { randomUUID } from 'crypto';
class MemoryService {
    async summarizeContext(messages, systemPrompt, maxTokens = 400) {
        const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `请用尽量精炼的中文总结以下多轮对话的关键信息（人物、意图、事实、待办、上下文前提），限制在约200字内：\n\n${text}`;
        const { content } = await langchain.invoke([{ role: 'user', content: prompt }], {
            systemPrompt,
            max_tokens: maxTokens,
            temperature: 0.2,
        });
        return content.trim();
    }
    async prepare(messages, options) {
        const sessionId = options.sessionId || randomUUID();
        const systemPrompt = options.systemPrompt;
        // 读取历史
        const historyMessages = await history.getHistory(sessionId);
        // 拼装用于模型的消息：系统提示 + 总结 + 历史片段 + 本次消息
        const combined = [];
        if (systemPrompt) {
            combined.push({ role: 'system', content: systemPrompt });
        }
        // 简单策略：当历史超过阈值时，做一次总结，并只保留最近几条作为示例
        const window = options.summaryWindow ?? 12;
        if (historyMessages.length > window) {
            const summary = await this.summarizeContext(historyMessages, systemPrompt, options.maxTokens ?? 400);
            combined.push({ role: 'system', content: `以下是此前对话的浓缩总结：${summary}` });
            const recent = historyMessages.slice(-Math.floor(window / 2));
            combined.push(...recent);
        }
        else {
            combined.push(...historyMessages);
        }
        combined.push(...messages);
        return { sessionId, messagesForModel: combined };
    }
    async append(sessionId, newMessages) {
        await history.appendMessages(sessionId, newMessages);
    }
}
export default new MemoryService();

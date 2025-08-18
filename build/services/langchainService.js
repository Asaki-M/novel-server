import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import config from "../config/index.js";
function toLangChainMessages(messages, systemPrompt) {
    const result = [];
    if (systemPrompt && systemPrompt.trim().length > 0) {
        result.push(new SystemMessage(systemPrompt));
    }
    for (const m of messages) {
        if (m.role === "system") {
            result.push(new SystemMessage(m.content));
        }
        else if (m.role === "user") {
            result.push(new HumanMessage(m.content));
        }
        else {
            result.push(new AIMessage(m.content));
        }
    }
    return result;
}
function resolveContent(content) {
    if (typeof content === "string")
        return content;
    if (Array.isArray(content)) {
        return content.map((c) => (typeof c === "string" ? c : JSON.stringify(c))).join("");
    }
    return String(content ?? "");
}
class LangChainService {
    createModel(opts) {
        return new ChatOpenAI({
            apiKey: config.openrouter.apiKey,
            model: config.openrouter.model,
            temperature: opts.temperature ?? 0.7,
            maxTokens: opts.max_tokens,
            configuration: {
                baseURL: config.openrouter.baseUrl,
                defaultHeaders: {
                    "HTTP-Referer": config.app.referer,
                    "X-Title": config.app.name,
                },
            },
        });
    }
    async invoke(messages, options) {
        const { temperature, max_tokens, systemPrompt } = options;
        const model = this.createModel({ temperature, max_tokens });
        const lcMessages = toLangChainMessages(messages, systemPrompt);
        const res = await model.invoke(lcMessages);
        const content = resolveContent(res.content);
        const usage = res.usage_metadata;
        return { content, usage };
    }
    async *stream(messages, options) {
        const { temperature, max_tokens, systemPrompt } = options;
        const model = this.createModel({ temperature, max_tokens });
        const lcMessages = toLangChainMessages(messages, systemPrompt);
        const stream = await model.stream(lcMessages);
        for await (const chunk of stream) {
            const delta = resolveContent(chunk.content);
            if (delta)
                yield delta;
        }
    }
}
export default new LangChainService();

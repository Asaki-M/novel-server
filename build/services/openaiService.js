import OpenAI from 'openai';
import config from '../config/index.js';
class OpenAIService {
    client;
    constructor() {
        this.client = new OpenAI({
            baseURL: config.openrouter.baseUrl,
            apiKey: config.openrouter.apiKey,
        });
    }
    async createChatCompletion(messages, options = {}) {
        const { temperature = 0.7, max_tokens = 2048, stream = false } = options;
        const baseParams = {
            model: config.openrouter.model,
            messages: messages,
            temperature,
            max_tokens,
        };
        const headers = {
            "HTTP-Referer": config.app.referer,
            "X-Title": config.app.name,
        };
        if (stream) {
            return this.client.chat.completions.create({
                ...baseParams,
                stream: true,
            }, { headers });
        }
        else {
            return this.client.chat.completions.create({
                ...baseParams,
                stream: false,
            }, { headers });
        }
    }
    async getModels() {
        return this.client.models.list();
    }
}
export default new OpenAIService();

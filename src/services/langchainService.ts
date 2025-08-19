import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import config from "../config/index.js";
import { ChatMessage } from "../types/chat.js";
import supabase from "../config/supabase.js";

export interface LangChainCallOptions {
	temperature?: number;
	max_tokens?: number;
	systemPrompt?: string;
	sessionId?: string;
	summaryWindow?: number;
	summaryMaxTokens?: number;
}

function toLangChainMessages(messages: ChatMessage[], systemPrompt?: string): BaseMessage[] {
	const result: BaseMessage[] = [];
	if (systemPrompt && systemPrompt.trim().length > 0) {
		result.push(new SystemMessage(systemPrompt));
	}
	for (const m of messages) {
		if (m.role === "system") {
			result.push(new SystemMessage(m.content));
		} else if (m.role === "user") {
			result.push(new HumanMessage(m.content));
		} else {
			result.push(new AIMessage(m.content));
		}
	}
	return result;
}

function resolveContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content.map((c) => (typeof c === "string" ? c : JSON.stringify(c))).join("");
	}
	return String(content ?? "");
}

class LangChainService {
	private createModel(opts: { temperature?: number; max_tokens?: number }) {
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

	// ========= 基础无记忆 =========
	async invoke(messages: ChatMessage[], options: LangChainCallOptions) {
		const { temperature, max_tokens, systemPrompt } = options;
		const model = this.createModel({ temperature, max_tokens });
		const lcMessages = toLangChainMessages(messages, systemPrompt);
		const res = await model.invoke(lcMessages);
		const content = resolveContent(res.content);
		const usage = (res as any).usage_metadata;
		return { content, usage } as { content: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
	}

	async *stream(messages: ChatMessage[], options: LangChainCallOptions) {
		const { temperature, max_tokens, systemPrompt } = options;
		const model = this.createModel({ temperature, max_tokens });
		const lcMessages = toLangChainMessages(messages, systemPrompt);
		const stream = await model.stream(lcMessages);
		for await (const chunk of stream) {
			const delta = resolveContent((chunk as any).content);
			if (delta) yield delta;
		}
	}

	// ========= Supabase 历史读写 =========
	private async getHistory(sessionId: string): Promise<ChatMessage[]> {
		if (!sessionId) return [];
		const { data, error } = await supabase
			.from("chat_messages")
			.select("role, content, created_at")
			.eq("session_id", sessionId)
			.order("created_at", { ascending: true });
		if (error) throw error;
		return (data || []).map((row: any) => ({ role: row.role, content: row.content }));
	}

	private async appendMessages(sessionId: string, msgs: ChatMessage[]): Promise<void> {
		if (!sessionId || msgs.length === 0) return;
		const rows = msgs.map((m) => ({ session_id: sessionId, role: m.role, content: m.content }));
		const { error } = await supabase.from("chat_messages").insert(rows);
		if (error) throw error;
	}

	private async summarizeContext(messages: ChatMessage[], systemPrompt?: string, maxTokens: number = 400): Promise<string> {
		const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
		const prompt = `请用尽量精炼的中文总结以下多轮对话的关键信息（人物、意图、事实、待办、上下文前提），限制在约200字内：\n\n${text}`;
		const { content } = await this.invoke([{ role: "user", content: prompt }], {
			systemPrompt,
			max_tokens: maxTokens,
			temperature: 0.2,
		});
		return content.trim();
	}

	private async buildMessagesWithMemory(input: ChatMessage[], opts: LangChainCallOptions): Promise<{ sessionId?: string; combined: ChatMessage[] }> {
		const sessionId = opts.sessionId;
		if (!sessionId) return { sessionId, combined: input };

		const history = await this.getHistory(sessionId);
		const combined: ChatMessage[] = [];

		if (opts.systemPrompt) {
			combined.push({ role: "system", content: opts.systemPrompt });
		}

		const window = opts.summaryWindow ?? 12;
		if (history.length > window) {
			const summary = await this.summarizeContext(history, opts.systemPrompt, opts.summaryMaxTokens ?? 400);
			combined.push({ role: "system", content: `以下是此前对话的浓缩总结：${summary}` });
			const recent = history.slice(-Math.floor(window / 2));
			combined.push(...recent);
		} else {
			combined.push(...history);
		}

		combined.push(...input);
		return { sessionId, combined };
	}

	// ========= 带记忆的调用 =========
	async invokeWithMemory(messages: ChatMessage[], options: LangChainCallOptions) {
		const { temperature, max_tokens } = options;
		const { sessionId, combined } = await this.buildMessagesWithMemory(messages, options);
		const result = await this.invoke(combined, { temperature, max_tokens });

		// 落库：追加本轮 user/assistant
		if (sessionId) {
			const lastUser = messages[messages.length - 1];
			const toAppend: ChatMessage[] = [];
			if (lastUser?.role === "user") toAppend.push(lastUser);
			if (result.content) toAppend.push({ role: "assistant", content: result.content });
			if (toAppend.length) await this.appendMessages(sessionId, toAppend);
		}
		return result;
	}

	async *streamWithMemory(messages: ChatMessage[], options: LangChainCallOptions) {
		const { temperature, max_tokens } = options;
		const { sessionId, combined } = await this.buildMessagesWithMemory(messages, options);
		const model = this.createModel({ temperature, max_tokens });
		const lcMessages = toLangChainMessages(combined);
		const stream = await model.stream(lcMessages);
		let full = "";
		for await (const chunk of stream) {
			const delta = resolveContent((chunk as any).content);
			if (delta) {
				full += delta;
				yield delta;
			}
		}
		// 落库
		if (sessionId) {
			const lastUser = messages[messages.length - 1];
			const toAppend: ChatMessage[] = [];
			if (lastUser?.role === "user") toAppend.push(lastUser);
			if (full) toAppend.push({ role: "assistant", content: full });
			if (toAppend.length) await this.appendMessages(sessionId, toAppend);
		}
	}
}

export default new LangChainService(); 
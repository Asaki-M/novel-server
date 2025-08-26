import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import config from "../config/index.js";
import { ChatMessage } from "../types/chat.js";
import supabase from "../config/supabase.js";
import { selectTools } from "../tools/index.js";

export interface LangChainCallOptions {
	temperature?: number | undefined;
	max_tokens?: number | undefined;
	systemPrompt?: string | undefined;
	sessionId?: string | undefined;
	summaryWindow?: number | undefined;
	summaryMaxTokens?: number | undefined;
	// 工具相关
	useTools?: boolean | undefined;
	allowedTools?: string[] | undefined;
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
	private createModel(opts: { temperature?: number | undefined; max_tokens?: number | undefined }) {
		const init: any = {
			apiKey: config.openrouter.apiKey,
			model: config.openrouter.model,
			temperature: opts.temperature ?? 0.7,
			configuration: {
				baseURL: config.openrouter.baseUrl,
				defaultHeaders: {
					"HTTP-Referer": config.app.referer,
					"X-Title": config.app.name,
				},
			},
		};
		if (typeof opts.max_tokens === "number") {
			init.maxTokens = opts.max_tokens;
		}
		return new ChatOpenAI(init);
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
		try {
			const { content } = await this.invoke([{ role: "user", content: prompt }], {
				...(systemPrompt ? { systemPrompt } : {}),
				max_tokens: maxTokens,
				temperature: 0.2,
			});
			return content.trim();
		} catch (err: any) {
			console.warn('摘要失败，使用回退策略');
			const recent = messages.slice(-6);
			const fallback = recent.map((m) => `${m.role}: ${m.content}`.slice(0, 120)).join(" | ");
			return `摘要不可用，使用最近上下文：${fallback}`;
		}
	}

	private async buildMessagesWithMemory(input: ChatMessage[], opts: LangChainCallOptions): Promise<{ sessionId?: string; combined: ChatMessage[] }> {
		const sessionId = opts.sessionId;
		if (!sessionId) return { combined: input };

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
		const result = await this.invoke(combined, { ...(typeof temperature === 'number' ? { temperature } : {}), ...(typeof max_tokens === 'number' ? { max_tokens } : {}) });

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

	// ========= 一回合工具调用（非流式）=========
	async invokeWithTools(messages: ChatMessage[], options: LangChainCallOptions) {
		const { temperature, max_tokens, systemPrompt, allowedTools } = options;
		const model = this.createModel({ temperature, max_tokens });

		// 手动协议：模型以 JSON 返回工具调用意图
		const tools = selectTools(allowedTools);
		const toolInstruction = `如果你需要调用工具，请严格输出如下JSON：\n{"tool_name":"<tool_name>","arguments":{...}}。\n可用工具：\n${tools
			.map((t) => `- ${t.name}: ${t.description}, schema: ${t.schema.toString()}`)
			.join("\n")}\n如果不需要工具，直接输出答案文本。`;

		const lcMessages = toLangChainMessages(
			[{ role: "system", content: toolInstruction }, ...messages],
			systemPrompt
		);
		const res = await model.invoke(lcMessages);
		const raw = resolveContent(res.content);

		// 尝试解析工具调用
		let parsed: any = null;
		try {
			parsed = JSON.parse(raw);
		} catch {}

		if (!parsed || typeof parsed !== "object" || !parsed.tool_name) {
			// 非工具输出，直接返回文本
			return { content: raw } as { content: string };
		}

		const tool = tools.find((t) => t.name === parsed.tool_name);
		if (!tool) {
			return { content: `工具 ${parsed.tool_name} 不可用或未被允许。原始输出：` + raw };
		}

		// 参数兜底：为插画工具缺失的 prompt 回填最后一条用户消息
		if (tool.name === 'generate_illustration') {
			const lastUser = [...messages].reverse().find((m) => m.role === 'user');
			if (lastUser && (!parsed.arguments || typeof parsed.arguments.prompt !== 'string' || parsed.arguments.prompt.trim().length === 0)) {
				parsed.arguments = { ...(parsed.arguments || {}), prompt: lastUser.content };
			}
			// 添加sessionId参数用于图片存储
			if (options.sessionId) {
				parsed.arguments = { ...(parsed.arguments || {}), sessionId: options.sessionId };
			}
		}

		// 参数校验
		let args: any;
		try {
			args = tool.schema.parse(parsed.arguments ?? {});
		} catch (e: any) {
			return { content: `工具参数不合法：${e?.message || e}` };
		}

		// 执行工具
		const result = await tool.call(args as any);
		// 若工具返回 base64，则补上 data URL 前缀；若返回 data url 或 http(s) url，则完整透传
		if (result && typeof result === 'object') {
			if (typeof (result as any).base64 === 'string' && (result as any).base64.length > 0) {
				return { content: `data:image/png;base64,${(result as any).base64}` } as { content: string };
			}
			if (typeof (result as any).url === 'string') {
				const url = (result as any).url;
				// 支持data URL、http和https URL
				if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
					return { content: url } as { content: string };
				}
			}
		}
		return { content: JSON.stringify({ tool_result: result }) } as { content: string };
	}

	// ========= 带记忆 + 工具（单回合）=========
	async invokeWithMemoryAndTools(messages: ChatMessage[], options: LangChainCallOptions) {
		const { sessionId } = options;
		// 工具调用仅依据用户最后一条消息决定参数，不使用总结内容
		const lastUser = [...messages].reverse().find((m) => m.role === 'user');
		const inputForTool = lastUser ? [lastUser] : messages.slice(-1);
		const result = await this.invokeWithTools(inputForTool, options);

		// 落库：现在图片返回的是Storage URL而不是大体积base64，可以直接存储
		if (sessionId) {
			const toAppend: ChatMessage[] = [];
			if (lastUser) toAppend.push(lastUser);
			if (result.content) {
				// 检查是否为大体积的base64 data URL（作为回退情况）
				const isLargeBase64DataUrl = typeof result.content === 'string' && 
					result.content.startsWith('data:image/') && 
					result.content.length > 10000; // 大于10KB的base64视为大文件
				
				if (isLargeBase64DataUrl) {
					// 只对大体秏base64使用占位符
					const assistantContent = `[image_generated length=${result.content.length}]`;
					toAppend.push({ role: "assistant", content: assistantContent });
				} else {
					// Storage URL或小图片直接存储
					toAppend.push({ role: "assistant", content: result.content });
				}
			}
			if (toAppend.length) await this.appendMessages(sessionId, toAppend);
		}

		return result;
	}
}

export default new LangChainService(); 
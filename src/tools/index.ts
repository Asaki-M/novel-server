import { z } from "zod";
import { InferenceClient } from "@huggingface/inference";

// ============ 工具（Hugging Face 实现）============
// 生成插画
export const generateIllustrationSchema = z.object({
	prompt: z.string().min(1, "prompt is required"),
	style: z.string().optional(),
});

async function hfCallImageAPI(input: { prompt: string; style?: string }): Promise<{ url: string }> {
	const token = process.env['HF_TOKEN'] ?? '';
	if (!token) {
		throw new Error('HF_TOKEN 未配置');
	}
	const client = new InferenceClient(token);
	const prompt = input.style ? `${input.prompt}，风格：${input.style}` : input.prompt;

	console.log('prompt', prompt);

	const output: any = await client.textToImage({
		provider: 'auto',
		model: 'Qwen/Qwen-Image',
		inputs: prompt,
		parameters: { num_inference_steps: 20 },
	});

	let dataUrl: string;
	if (typeof output === 'string') {
		dataUrl = output.startsWith('data:') ? output : `data:image/png;base64,${output}`;
	} else if (output && typeof output.arrayBuffer === 'function') {
		const ab = await output.arrayBuffer();
		const base64 = Buffer.from(ab).toString('base64');
		dataUrl = `data:image/png;base64,${base64}`;
	} else if (output instanceof ArrayBuffer) {
		const base64 = Buffer.from(output).toString('base64');
		dataUrl = `data:image/png;base64,${base64}`;
	} else if (output instanceof Uint8Array) {
		const base64 = Buffer.from(output).toString('base64');
		dataUrl = `data:image/png;base64,${base64}`;
	} else {
		dataUrl = String(output);
	}

	return { url: dataUrl };
}

export type Tool = {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	call: (args: any) => Promise<any>;
};

const allTools = {
	generate_illustration: {
		name: "generate_illustration",
		description: "根据剧情与风格生成插画，返回 data URL",
		schema: generateIllustrationSchema,
		call: hfCallImageAPI,
	},
} as const;

export type ToolName = keyof typeof allTools;

export function selectTools(allowed?: string[]): Tool[] {
	if (!allowed || allowed.length === 0) return Object.values(allTools) as unknown as Tool[];
	const set = new Set(allowed as string[]);
	return (Object.values(allTools) as unknown as Tool[]).filter((t) => set.has(t.name));
} 
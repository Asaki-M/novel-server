import { z } from "zod";
import { InferenceClient } from "@huggingface/inference";
import imageStorageService from '../services/imageStorageService.js';

// ============ 工具（Hugging Face 实现）============
// 生成插画
export const generateIllustrationSchema = z.object({
	prompt: z.string().min(1, "prompt is required"),
	style: z.string().optional(),
	sessionId: z.string().optional(),
});

async function hfCallImageAPI(input: { prompt: string; style?: string; sessionId?: string }): Promise<{ url: string }> {
	const token = process.env['HF_TOKEN'] ?? '';
	if (!token) {
		throw new Error('HF_TOKEN 未配置');
	}
	const client = new InferenceClient(token);
	
	// 构建生成prompt
	const basePrompt = input.style ? `${input.prompt}，风格：${input.style}` : input.prompt;
	const prompt = `${basePrompt}, high quality`;

	console.log('生成图片prompt:', prompt);

	const output: any = await client.textToImage({
		provider: 'auto',
		model: 'Qwen/Qwen-Image',
		inputs: prompt,
		parameters: { 
			num_inference_steps: 20
		},
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

	try {
		// 上传图片到Supabase Storage
		const storageResult = await imageStorageService.uploadDataUrl(dataUrl, input.sessionId);
		console.log('图片已上传到Supabase Storage:', storageResult.url);
		
		// 返回Storage URL而不是base64
		return { url: storageResult.url };
	} catch (storageError: any) {
		console.warn('图片上传到Storage失败，回退到base64:', storageError.message);
		// 如果Storage失败，回退到原来的base64方式
		return { url: dataUrl };
	}
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
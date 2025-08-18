import dotenv from 'dotenv';
// 加载环境变量
dotenv.config();
const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-14b:free',
    },
    app: {
        name: 'Novel Server Chat API',
        referer: process.env.APP_REFERER || 'http://localhost:3000',
    },
};
// 验证必需的配置
export function validateConfig() {
    if (!config.openrouter.apiKey) {
        throw new Error('OPENROUTER_API_KEY is required');
    }
    console.log('✅ 配置验证通过，使用纯聊天模式');
}
export default config;

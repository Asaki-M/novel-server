import { randomUUID } from 'crypto';
class CharacterService {
    characters = new Map();
    constructor() {
        this.initBuiltInCharacters();
    }
    /**
     * 初始化内置角色卡
     */
    initBuiltInCharacters() {
        const builtInCharacters = [
            {
                name: '小说创作助手',
                avatar: '📚',
                description: '专业的小说创作助手，擅长各种类型的小说创作和情节构思',
                systemPrompt: `你是一位专业的小说创作助手，拥有丰富的文学创作经验。

## 你的特长
- 熟悉各种文学体裁和创作技巧
- 擅长人物塑造、情节构思、世界观设定
- 能够根据不同类型调整写作风格
- 注重细节描写和情感表达

## 创作原则
- 保持故事逻辑性和连贯性
- 注重人物性格的一致性和成长
- 营造恰当的氛围和节奏
- 使用生动的描写和对话

请根据用户的需求进行创作，可以是故事大纲、人物设定、具体章节内容等。`,
                personality: ['专业', '创意', '细致', '有耐心'],
                tags: ['小说', '创作', '写作', '文学'],
                category: 'novel',
                isBuiltIn: true,
                isPublic: true,
                usageCount: 0,
                examples: [
                    {
                        user: '帮我写一个科幻小说的开头',
                        assistant: '好的！让我为你创作一个引人入胜的科幻小说开头...'
                    }
                ]
            },
            {
                name: '霸道总裁',
                avatar: '💼',
                description: '高冷霸道的总裁角色，适合都市言情小说创作',
                systemPrompt: `你是一位霸道总裁角色，具有以下特点：

## 角色设定
- 年龄：28-35岁，事业有成的企业家
- 性格：外表高冷霸道，内心深情专一
- 背景：出身豪门或白手起家，掌控庞大商业帝国
- 说话风格：简洁有力，带有命令性语气

## 行为特点
- 对工作极其认真，要求完美
- 在感情上容易吃醋，占有欲强
- 表达爱意的方式直接而霸道
- 会用行动证明自己的心意

## 常用语言模式
- "你只能是我的"
- "我说的话就是命令"
- "除了我，谁都不许碰你"

请以这个角色进行对话和创作相关情节。`,
                personality: ['霸道', '深情', '高冷', '专一'],
                tags: ['总裁', '言情', '霸道', '都市'],
                category: 'roleplay',
                isBuiltIn: true,
                isPublic: true,
                usageCount: 0,
                examples: [
                    {
                        user: '今天的会议怎么样？',
                        assistant: '会议按我的要求进行，那些不听话的股东已经被我处理了。现在，过来，我有更重要的事要和你说。'
                    }
                ]
            },
            {
                name: '古风才子',
                avatar: '🎋',
                description: '温文尔雅的古代书生，擅长诗词歌赋和古典文学',
                systemPrompt: `你是一位古风才子角色，具有以下特点：

## 角色设定
- 时代背景：古代文人学士
- 性格：温文尔雅，博学多才，风度翩翩
- 特长：诗词歌赋，琴棋书画样样精通
- 说话风格：文雅古典，常用文言文表达

## 知识背景
- 熟读四书五经，通晓古典文学
- 擅长作诗填词，对仗工整
- 了解古代礼仪和文化习俗
- 能够创作古典小说和散文

## 语言特色
- 使用古典雅致的表达方式
- 适当引用诗词典故
- 语调温和，措辞优美
- 偶尔用文言文增加古典韵味

请以这个角色身份进行创作和对话。`,
                personality: ['温文尔雅', '博学', '才华横溢', '谦逊'],
                tags: ['古风', '才子', '诗词', '文学'],
                category: 'roleplay',
                isBuiltIn: true,
                isPublic: true,
                usageCount: 0,
                examples: [
                    {
                        user: '能为春天写首诗吗？',
                        assistant: '春风得意马蹄疾，一日看尽长安花。容在下为姑娘即兴赋诗一首：\n\n《春韵》\n春风十里不如卿，\n桃花映面更娉婷。\n愿君莫负好时光，\n执手相伴到天明。'
                    }
                ]
            },
            {
                name: '智能助手',
                avatar: '🤖',
                description: '通用智能助手，可以回答问题、提供建议和协助完成各种任务',
                systemPrompt: `你是一个智能助手，具有以下特点：

## 核心能力
- 回答各种问题，提供准确的信息
- 协助用户完成日常任务和工作
- 提供建议和解决方案
- 进行友好而专业的对话

## 行为准则
- 保持友善、耐心和专业的态度
- 提供准确、有用的信息
- 承认知识的局限性
- 尊重用户的隐私和价值观

## 回答风格
- 清晰、简洁、易懂
- 结构化组织信息
- 提供实用的建议
- 适当使用例子说明

请根据用户的需求提供帮助和支持。`,
                personality: ['友善', '专业', '可靠', '有帮助'],
                tags: ['助手', '通用', '问答', '实用'],
                category: 'assistant',
                isBuiltIn: true,
                isPublic: true,
                usageCount: 0,
                examples: [
                    {
                        user: '如何提高工作效率？',
                        assistant: '提高工作效率可以从以下几个方面入手：\n\n1. **时间管理**：使用番茄工作法或时间块管理\n2. **优先级排序**：重要紧急四象限法\n3. **减少干扰**：关闭通知，专注当前任务\n4. **合理休息**：保持良好的工作节奏\n\n你希望我详细介绍哪个方面呢？'
                    }
                ]
            }
        ];
        builtInCharacters.forEach(char => {
            const character = {
                ...char,
                id: randomUUID(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.characters.set(character.id, character);
        });
    }
    /**
     * 创建角色卡
     */
    createCharacter(request, createdBy) {
        const character = {
            id: randomUUID(),
            name: request.name,
            avatar: request.avatar,
            description: request.description,
            systemPrompt: request.systemPrompt,
            personality: request.personality,
            tags: request.tags,
            category: request.category,
            isBuiltIn: false,
            isPublic: request.isPublic || false,
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0,
            examples: request.examples,
        };
        this.characters.set(character.id, character);
        return character;
    }
    /**
     * 获取角色卡
     */
    getCharacter(id) {
        return this.characters.get(id) || null;
    }
    /**
     * 更新角色卡
     */
    updateCharacter(id, updates) {
        const character = this.characters.get(id);
        if (!character || character.isBuiltIn)
            return null;
        const updatedCharacter = {
            ...character,
            ...updates,
            updatedAt: new Date(),
        };
        this.characters.set(id, updatedCharacter);
        return updatedCharacter;
    }
    /**
     * 删除角色卡
     */
    deleteCharacter(id) {
        const character = this.characters.get(id);
        if (!character || character.isBuiltIn)
            return false;
        return this.characters.delete(id);
    }
    /**
     * 搜索角色卡
     */
    searchCharacters(query = {}) {
        const { category, tags, keyword, page = 1, limit = 20, sortBy = 'popular' } = query;
        let filteredCharacters = Array.from(this.characters.values());
        // 分类筛选
        if (category) {
            filteredCharacters = filteredCharacters.filter(char => char.category === category);
        }
        // 标签筛选
        if (tags && tags.length > 0) {
            filteredCharacters = filteredCharacters.filter(char => tags.some(tag => char.tags.includes(tag)));
        }
        // 关键词搜索
        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            filteredCharacters = filteredCharacters.filter(char => char.name.toLowerCase().includes(lowerKeyword) ||
                char.description.toLowerCase().includes(lowerKeyword) ||
                char.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)));
        }
        // 排序
        filteredCharacters.sort((a, b) => {
            switch (sortBy) {
                case 'popular':
                    return b.usageCount - a.usageCount;
                case 'newest':
                    return b.createdAt.getTime() - a.createdAt.getTime();
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return b.usageCount - a.usageCount;
            }
        });
        // 分页
        const total = filteredCharacters.length;
        const start = (page - 1) * limit;
        const end = start + limit;
        const pagedCharacters = filteredCharacters.slice(start, end);
        // 转换为列表项格式
        const characters = pagedCharacters.map(char => ({
            id: char.id,
            name: char.name,
            avatar: char.avatar,
            description: char.description,
            personality: char.personality,
            tags: char.tags,
            category: char.category,
            isBuiltIn: char.isBuiltIn,
            usageCount: char.usageCount,
            rating: char.rating,
        }));
        return {
            characters,
            total,
            page,
            limit,
        };
    }
    /**
     * 增加使用次数
     */
    incrementUsage(id) {
        const character = this.characters.get(id);
        if (character) {
            character.usageCount++;
            this.characters.set(id, character);
        }
    }
    /**
     * 获取分类统计
     */
    getCategoryStats() {
        const stats = new Map();
        this.characters.forEach(char => {
            stats.set(char.category, (stats.get(char.category) || 0) + 1);
        });
        return Array.from(stats.entries()).map(([category, count]) => ({
            category,
            count,
        }));
    }
    /**
     * 获取热门标签
     */
    getPopularTags(limit = 20) {
        const tagCounts = new Map();
        this.characters.forEach(char => {
            char.tags.forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
}
export default new CharacterService();

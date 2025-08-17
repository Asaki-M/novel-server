-- 启用向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建记忆块表
CREATE TABLE IF NOT EXISTS memory_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small 的维度
    message_count INTEGER NOT NULL DEFAULT 0,
    characters TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    importance FLOAT NOT NULL DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}',
    
    -- 索引
    CONSTRAINT unique_session_chunk UNIQUE (session_id, chunk_index)
);

-- 创建会话信息表
CREATE TABLE IF NOT EXISTS session_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    tags TEXT[] DEFAULT '{}',
    characters TEXT[] DEFAULT '{}',
    plot_outline TEXT DEFAULT '',
    current_chunk INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    last_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 创建向量相似度搜索函数
CREATE OR REPLACE FUNCTION search_memory_chunks(
    query_embedding vector(1536),
    session_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    chunk_index INTEGER,
    content TEXT,
    summary TEXT,
    embedding vector(1536),
    message_count INTEGER,
    characters TEXT[],
    keywords TEXT[],
    importance FLOAT,
    created_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id,
        mc.session_id,
        mc.chunk_index,
        mc.content,
        mc.summary,
        mc.embedding,
        mc.message_count,
        mc.characters,
        mc.keywords,
        mc.importance,
        mc.created_at,
        mc.metadata,
        1 - (mc.embedding <=> query_embedding) AS similarity
    FROM memory_chunks mc
    WHERE 
        mc.session_id = search_memory_chunks.session_id
        AND 1 - (mc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY mc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_memory_chunks_session_id ON memory_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding ON memory_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_importance ON memory_chunks(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_created_at ON memory_chunks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_info_updated_at ON session_info(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_info_genre ON session_info(genre);

-- 创建自动更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_info_updated_at
    BEFORE UPDATE ON session_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 设置RLS (Row Level Security) 如果需要多用户支持
-- ALTER TABLE memory_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE session_info ENABLE ROW LEVEL SECURITY;

-- 示例：为当前用户创建策略
-- CREATE POLICY "Users can view own memory chunks" ON memory_chunks
--     FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE memory_chunks IS '小说创作记忆块存储表';
COMMENT ON TABLE session_info IS '创作会话信息表';
COMMENT ON FUNCTION search_memory_chunks IS '向量相似度搜索记忆块'; 
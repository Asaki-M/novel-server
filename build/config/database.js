const databaseConfig = {
    // 优先使用 Supabase (免费且Vercel友好)
    type: process.env.VECTOR_DB_TYPE || 'supabase',
    supabase: {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_ANON_KEY || '',
    },
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY || '',
        environment: process.env.PINECONE_ENVIRONMENT || 'gcp-starter',
        indexName: process.env.PINECONE_INDEX_NAME || 'novel-memory',
    },
    embedding: {
        provider: process.env.EMBEDDING_PROVIDER || 'openai',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
    },
};
export default databaseConfig;

import process from 'node:process'
import { S3Client } from '@aws-sdk/client-s3'

// Supabase S3 配置
const supabaseRegion = process.env['SUPABASE_STORAGE_REGION'] || 'us-east-1'
const supabaseAccessKeyId = process.env['SUPABASE_STORAGE_ACCESS_KEY_ID'] || ''
const supabaseSecretAccessKey = process.env['SUPABASE_STORAGE_ACCESS_KEY'] || ''

if (!supabaseAccessKeyId || !supabaseSecretAccessKey) {
  throw new Error('Supabase S3 credentials missing: please set SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY')
}

// 创建 S3 客户端实例
const s3Client = new S3Client({
  forcePathStyle: true,
  region: supabaseRegion,
  endpoint: 'https://qzscuzndpxdygetaacsf.storage.supabase.co/storage/v1/s3',
  credentials: {
    accessKeyId: supabaseAccessKeyId,
    secretAccessKey: supabaseSecretAccessKey,
  },
})

export default s3Client

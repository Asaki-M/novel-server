import { DeleteObjectsCommand, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import s3Client from '../config/s3.js'

export interface ImageStorageResult {
  url: string
  publicUrl: string
  path: string
}

class ImageStorageService {
  private readonly bucketName = 'text_to_image'

  /**
   * 获取文件的公开访问URL
   * @param filePath - 文件路径
   * @returns 公开访问URL
   */
  private getPublicUrl(filePath: string): string {
    return `https://qzscuzndpxdygetaacsf.supabase.co/storage/v1/object/public/${this.bucketName}/${filePath}`
  }

  /**
   * 直接上传 Blob 到 Supabase Storage (S3 API)
   * @param blob - Blob 对象
   * @param sessionId - 会话ID，用于组织文件路径
   * @returns 上传结果，包含访问URL
   */
  async uploadBlob(blob: Blob, sessionId?: string): Promise<ImageStorageResult> {
    try {
      // 生成唯一文件名
      const timestamp = Date.now()
      const uuid = uuidv4()
      const filename = `${timestamp}-${uuid}.png`

      // 组织文件路径：按会话ID分组
      const folderPath = sessionId ? `sessions/${sessionId}` : 'general'
      const filePath = `${folderPath}/${filename}`

      // 将 Blob 转换为 ArrayBuffer，然后转为 Buffer
      const arrayBuffer = await blob.arrayBuffer()
      // eslint-disable-next-line node/prefer-global/buffer
      const buffer = Buffer.from(arrayBuffer)

      // 使用S3 API上传文件
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: blob.type || 'image/png',
        CacheControl: 'public, max-age=3600', // 1小时缓存
      })

      await s3Client.send(command)

      // 构建返回结果
      const publicUrl = this.getPublicUrl(filePath)

      console.log(`✅ Blob 上传成功: ${publicUrl}`)

      return {
        url: publicUrl,
        publicUrl,
        path: filePath,
      }
    }
    catch (error) {
      console.error('Blob 上传失败:', error)
      throw new Error(`图片上传失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 清理会话相关的所有图片
   * @param sessionId - 会话ID
   */
  async cleanSessionImages(sessionId: string): Promise<void> {
    try {
      const folderPath = `sessions/${sessionId}/`

      // 列出文件夹中的所有文件
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: folderPath,
      })

      const listResult = await s3Client.send(listCommand)

      if (!listResult.Contents || listResult.Contents.length === 0) {
        return
      }

      // 批量删除文件
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: listResult.Contents.map(obj => ({ Key: obj.Key! })),
        },
      })

      await s3Client.send(deleteCommand)
    }
    catch (error: any) {
      console.error('清理会话图片错误:', error)
    }
  }

  /**
   * 确保存储桶存在并可访问
   */
  async ensureBucketExists(): Promise<void> {
    try {
      // 首先列出所有存储桶
      const listBucketsCommand = new ListBucketsCommand({})
      const bucketsResult = await s3Client.send(listBucketsCommand)

      if (bucketsResult.Buckets && bucketsResult.Buckets.length > 0) {
        // 检查目标桶是否存在
        const bucketExists = bucketsResult.Buckets.some(bucket => bucket.Name === this.bucketName)

        if (!bucketExists) {
          console.warn(`❌ 未找到目标Storage桶: ${this.bucketName}`)
          throw new Error(`存储桶 ${this.bucketName} 不存在`)
        }
      }
      else {
        throw new Error('没有找到任何存储桶，请检查S3配置')
      }

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      })

      await s3Client.send(command)
      console.log(`✅ Supabase Storage桶 ${this.bucketName} 访问正常 (S3 API)`)
    }
    catch (error: any) {
      console.error('🚨 Storage桶检查错误:', error)
    }
  }
}

export default new ImageStorageService()

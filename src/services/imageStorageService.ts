import { DeleteObjectCommand, DeleteObjectsCommand, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
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
   * 将base64图片上传到Supabase Storage (S3 API)
   * @param base64Data - base64编码的图片数据（不包含data:image/png;base64,前缀）
   * @param sessionId - 会话ID，用于组织文件路径
   * @returns 上传结果，包含访问URL
   */
  async uploadBase64Image(base64Data: string, sessionId?: string): Promise<ImageStorageResult> {
    try {
      // 生成唯一文件名
      const timestamp = Date.now()
      const uuid = uuidv4()
      const filename = `${timestamp}-${uuid}.png`

      // 组织文件路径：按会话ID分组
      const folderPath = sessionId ? `sessions/${sessionId}` : 'general'
      const filePath = `${folderPath}/${filename}`

      // 将base64转换为Buffer
      // eslint-disable-next-line node/prefer-global/buffer
      const buffer = Buffer.from(base64Data, 'base64')

      // 使用S3 API上传文件
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=3600', // 1小时缓存
      })

      await s3Client.send(command)

      // 生成公开访问URL
      const publicUrl = this.getPublicUrl(filePath)

      return {
        url: publicUrl,
        publicUrl,
        path: filePath,
      }
    }
    catch (error: any) {
      console.error('图片存储服务错误:', error)
      throw new Error(`图片存储失败: ${error.message}`)
    }
  }

  /**
   * 处理data URL格式的图片（包含data:image/png;base64,前缀）
   * @param dataUrl - 完整的data URL
   * @param sessionId - 会话ID（可选）
   * @returns 上传结果
   */
  async uploadDataUrl(dataUrl: string, sessionId?: string): Promise<ImageStorageResult> {
    // 提取base64数据
    const base64Match = dataUrl.match(/^data:image\/[a-zA-Z]*;base64,(.+)$/)
    if (!base64Match || !base64Match[1]) {
      throw new Error('无效的data URL格式')
    }

    const base64Data: string = base64Match[1]
    return this.uploadBase64Image(base64Data, sessionId)
  }

  /**
   * 删除指定路径的图片
   * @param filePath - 文件路径
   */
  async deleteImage(filePath: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      })

      await s3Client.send(command)
    }
    catch (error: any) {
      console.error('图片删除服务错误:', error)
      throw new Error(`图片删除失败: ${error.message}`)
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

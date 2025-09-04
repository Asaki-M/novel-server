import type { Express } from 'express'
import process from 'node:process'
import cors from 'cors'
import express from 'express'

import config, { validateConfig } from './config/index.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import routes from './routes/index.js'
import imageStorageService from './services/imageStorageService.js'

// 创建 Express 应用
const app: Express = express()

// 验证配置
try {
  validateConfig()
}
catch (error: any) {
  console.error('❌ 配置验证失败:', (error as Error).message)
  process.exit(1)
}

// 异步初始化Supabase Storage
async function initializeStorage() {
  try {
    await imageStorageService.ensureBucketExists()
    console.log('🗂️ Supabase Storage初始化成功')
  }
  catch (error: any) {
    console.warn('⚠️ Supabase Storage初始化失败:', error.message)
    console.warn('图片存储功能可能不可用，将回退到base64模式')
  }
}

// 启动存储初始化（非阻塞）
initializeStorage()

// 基础中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS 中间件
app.use(cors())
// 处理预检请求（OPTIONS）
app.options('*', cors())

// 路由
app.use('/', routes)

// 404 处理
app.use(notFoundHandler)

// 错误处理中间件
app.use(errorHandler)

// 仅在本地/非 Serverless 环境启动监听
const isVercel = process.env['VERCEL'] === '1'
if (!isVercel) {
  const server = app.listen(config.port, () => {
    console.log(`🚀 小说服务器启动成功！`)
    console.log(`📡 服务地址: http://localhost:${config.port}`)
    console.log(`💬 聊天接口: http://localhost:${config.port}/api/chat`)
  })

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('💤 接收到 SIGTERM 信号，正在优雅关闭服务器...')
    server.close(() => {
      console.log('✅ 服务器已关闭')
      process.exit(0)
    })
  })

  process.on('SIGINT', () => {
    console.log('💤 接收到 SIGINT 信号，正在优雅关闭服务器...')
    server.close(() => {
      console.log('✅ 服务器已关闭')
      process.exit(0)
    })
  })
}

export default app

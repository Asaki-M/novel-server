import fetch from 'node-fetch'
import config from '../config/index.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('RagService')

export interface RAGSearchDocument {
  relevance_score: number
  index: number
  document: {
    text: string
  }
}

export interface RAGSearchResponse {
  success: boolean
  documents: RAGSearchDocument[]
}

class RagService {
  private readonly baseUrl: string
  constructor() {
    this.baseUrl = config.ragServer?.baseUrl ?? ''
  }

  public async searchDocuments(query: string, knowledgeName: string) {
    if (!this.baseUrl) {
      logger.info('RAG 服务未配置')
      return []
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/knowledge-base/${knowledgeName}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      const data = await response.json() as RAGSearchResponse
      if (data.success) {
        return data.documents
      }
      else {
        logger.error('RAG 服务搜索失败')
        return []
      }
    }
    catch (error) {
      logger.error('RAG 服务搜索失败', error)
      return []
    }
  }
}

export default new RagService()

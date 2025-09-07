export function errorHandler(error: any, req: any, res: any): void {
  console.error('API错误:', error)

  let statusCode = 500
  let errorMessage = '服务器内部错误'

  if (error?.response?.status === 401) {
    statusCode = 401
    errorMessage = 'API密钥无效或已过期'
  }
  else if (error?.response?.status === 429) {
    statusCode = 429
    errorMessage = '请求过于频繁，请稍后重试'
  }
  else if (error?.response?.status === 400) {
    statusCode = 400
    errorMessage = '请求参数错误'
  }
  else if (error?.message) {
    errorMessage = error.message
  }

  const response = {
    success: false,
    error: errorMessage,
  }

  res.status(statusCode).json(response)
}

export function notFoundHandler(req: any, res: any): void {
  const response = {
    success: false,
    error: `路径 ${req.originalUrl} 不存在`,
  }

  res.status(404).json(response)
}

export type LogLevel = 'info' | 'log' | 'warn' | 'error'

export interface Logger {
  info: (...args: any[]) => void
  log: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

/**
 * 创建带前缀的日志器
 */
export function createLogger(prefix: string): Logger {
  const formatPrefix = `[${prefix}]:`

  return {
    info: (...args: any[]) => {
      console.info(formatPrefix, ...args)
    },

    log: (...args: any[]) => {
      console.log(formatPrefix, ...args)
    },

    warn: (...args: any[]) => {
      console.warn(formatPrefix, ...args)
    },

    error: (...args: any[]) => {
      console.error(formatPrefix, ...args)
    },
  }
}

// 默认导出创建函数
export default createLogger

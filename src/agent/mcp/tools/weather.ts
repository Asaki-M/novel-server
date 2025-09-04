import type { GenerateImageMCPResponse } from './index.js'

/**
 * 获取天气 - 用于 mcp 测试
 * @param city 城市
 * @returns 天气
 */
export function get_weather(city: string): GenerateImageMCPResponse {
  const cities = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '武汉', '南京', '天津']
  if (!cities.includes(city)) {
    return {
      type: 'text',
      text: '城市不存在',
    }
  }

  return {
    type: 'text',
    text: `The weather in ${city} is sunny.`,
  }
}

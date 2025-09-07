import getPort, { portNumbers } from 'get-port'
import { z } from 'zod'
import { createLogger } from '../../../utils/logger.js'
import { MCPServer } from '../server/index.js'

export async function startWeatherMCP() {
  const logger = createLogger('WeatherMCP')

  const name = 'weather'
  const version = '1.0.0'
  const mcpServer = new MCPServer(name, version)
  mcpServer.mcp.registerTool('get_weather', {
    title: '获取天气',
    description: '根据用户输入的城市获取天气',
    inputSchema: {
      city: z.string().describe('城市'),
    },
  }, ({ city }) => {
    const cities = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '武汉', '南京', '天津']
    if (!cities.includes(city)) {
      return {
        content: [{ type: 'text', text: '城市不存在' }],
      }
    }

    return {
      content: [{ type: 'text', text: `The weather in ${city} is sunny.` }],
    }
  })

  const port = await getPort({ port: portNumbers(3100, 3999) })
  await mcpServer.listen(port, 'localhost')

  logger.info(`服务已启动, 地址: http://localhost:${port}/mcp`)
  return {
    name,
    version,
    url: `http://localhost:${port}/mcp`,
  }
}

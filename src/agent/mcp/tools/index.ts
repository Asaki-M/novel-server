import { startGenerateImageMCP } from './generate-image/index.js'
import { startWeatherMCP } from './weather.js'

export async function startAllMCP() {
  const mcpServersDescrition = [
    {
      name: 'generate_image',
      starter: startGenerateImageMCP,
    },
    {
      name: 'weather',
      starter: startWeatherMCP,
    },
  ]

  const mcpServersConfig = await Promise.all(mcpServersDescrition.map(async ({ starter }) => {
    return await starter()
  }))

  return mcpServersConfig
}

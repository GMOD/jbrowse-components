import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiWiggle } = await import('../multiRendererHelper.ts')
  return renderMultiWiggle(
    pluginManager,
    renderProps,
    async (props, features) => {
      const { renderMultiXYPlot } = await import('./renderMultiXYPlot.ts')
      return renderMultiXYPlot(props, features)
    },
  )
}

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiXYPlot } = await import('./renderMultiXYPlot.ts')
  return renderMultiXYPlot(renderProps, pluginManager)
}

import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiDensity } = await import('./renderMultiDensity.ts')
  return renderMultiDensity(renderProps, pluginManager)
}

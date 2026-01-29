import type { MultiRenderArgsDeserialized } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiRowLine } = await import('./renderMultiRowLine.ts')
  return renderMultiRowLine(renderProps, pluginManager)
}

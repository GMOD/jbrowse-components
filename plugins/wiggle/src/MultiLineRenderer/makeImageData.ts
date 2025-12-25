import type { MultiRenderArgsDeserialized } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiWiggle } = await import('../multiRendererHelper')
  return renderMultiWiggle(pluginManager, renderProps, async (props, features) => {
    const { renderMultiLine } = await import('./renderMultiLine')
    return renderMultiLine(props, features)
  })
}

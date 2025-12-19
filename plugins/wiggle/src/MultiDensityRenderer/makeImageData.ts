import type { MultiRenderArgsDeserialized } from '../types'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function makeImageData(
  renderProps: MultiRenderArgsDeserialized,
  pluginManager: PluginManager,
) {
  const { renderMultiWiggle } = await import('../multiRendererHelper')
  return renderMultiWiggle(
    pluginManager,
    renderProps,
    async (props, arrays) => {
      const { renderMultiDensityArrays } =
        await import('./renderMultiDensityArrays')
      return renderMultiDensityArrays(props, arrays)
    },
    async (props, features) => {
      const { renderMultiDensity } = await import('./renderMultiDensity')
      return renderMultiDensity(props, features)
    },
  )
}

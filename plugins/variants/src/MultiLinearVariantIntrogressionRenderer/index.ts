import PluginManager from '@jbrowse/core/PluginManager'

import configSchema from './configSchema'
import MultiLinearVariantIntrogressionRenderer from './MultiLinearVariantIntrogressionRenderer'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiLinearVariantIntrogressionRenderer({
        name: 'MultiLinearVariantIntrogressionRenderer',
        ReactComponent:
          MultiLinearVariantIntrogressionRenderer.ReactComponent as any,
        configSchema,
        pluginManager,
      }),
  )
}

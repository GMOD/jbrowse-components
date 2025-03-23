import LinearVariantMatrixRenderer from './LinearVariantMatrixRenderer'
import configSchema from './configSchema'
import ReactComponent from '../shared/components/MultiVariantBaseRendering'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantMatrixRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(() => {
    return new LinearVariantMatrixRenderer({
      name: 'LinearVariantMatrixRenderer',
      displayName: 'Linear variant matrix renderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}

import MultiSVRenderer from './MultiSVRenderer'
import configSchema from './configSchema'
import ReactComponent from '../shared/components/MultiVariantBaseRendering'

import type PluginManager from '@jbrowse/core/PluginManager'

// locals

export default function MultiSVRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new MultiSVRenderer({
      name: 'MultiSVRenderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}

import SvgFeatureRenderer from './SvgFeatureRenderer'
import ReactComponent from './components/SvgFeatureRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SvgFeatureRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new SvgFeatureRenderer({
      name: 'SvgFeatureRenderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}

export { default as ReactComponent } from './components/SvgFeatureRendering'
export { default as configSchema } from './configSchema'

import ReactComponent from '../MultiWiggleRendering'
import MultiLineRenderer from './MultiLineRenderer'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLineRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiLineRenderer({
        name: 'MultiLineRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}

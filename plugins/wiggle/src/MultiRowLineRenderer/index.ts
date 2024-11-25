import ReactComponent from '../MultiWiggleRendering'
import MultiRowLineRenderer from './MultiRowLineRenderer'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowLineRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowLineRenderer({
        name: 'MultiRowLineRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}

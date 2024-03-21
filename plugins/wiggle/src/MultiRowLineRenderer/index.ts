import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponent from '../MultiWiggleRendering'
import MultiRowLineRenderer from './MultiRowLineRenderer'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiRowLineRenderer({
        ReactComponent,
        configSchema,
        name: 'MultiRowLineRenderer',
        pluginManager,
      }),
  )
}

import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import ReactComponent from '../WiggleRendering'
import LinePlotRenderer from './LinePlotRenderer'

export default function LinePlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LinePlotRenderer({
        name: 'LinePlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}

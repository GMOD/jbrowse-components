import configSchema from './configSchema'
import ReactComponent from '../WiggleRendering'
import LinePlotRenderer from './LinePlotRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'

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

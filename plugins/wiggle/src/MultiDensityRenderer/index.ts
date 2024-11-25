import configSchema from './configSchema'
import ReactComponent from '../MultiWiggleRendering'
import MultiDensityRenderer from './MultiDensityRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiDensityRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        name: 'MultiDensityRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}

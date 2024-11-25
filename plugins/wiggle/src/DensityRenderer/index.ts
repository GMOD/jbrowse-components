import DensityRenderer from './DensityRenderer'
import configSchema from './configSchema'
import ReactComponent from '../WiggleRendering'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function DensityRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new DensityRenderer({
        name: 'DensityRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}

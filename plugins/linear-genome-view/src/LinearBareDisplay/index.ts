import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

// locals
import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'
import { BaseLinearDisplayComponent } from '../BaseLinearDisplay/'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearBareDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'BasicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { configSchemaFactory } from './configSchema'
export { stateModelFactory } from './model'

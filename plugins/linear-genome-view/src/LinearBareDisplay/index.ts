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
      ReactComponent: BaseLinearDisplayComponent,
      configSchema,
      displayName: 'Bare feature display',
      name: 'LinearBareDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'BasicTrack',
      viewType: 'LinearGenomeView',
    })
  })
}

export { configSchemaFactory } from './configSchema'
export { stateModelFactory } from './model'

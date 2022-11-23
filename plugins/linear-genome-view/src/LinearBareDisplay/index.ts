import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '../BaseLinearDisplay'
import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'

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

export { configSchemaFactory, stateModelFactory }

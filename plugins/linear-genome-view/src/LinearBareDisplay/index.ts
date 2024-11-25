import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

// locals
import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'
import { BaseLinearDisplayComponent } from '../BaseLinearDisplay/'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearBareDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearBareDisplay',
      configSchema,
      displayName: 'Bare feature display',
      stateModel: stateModelFactory(configSchema),
      trackType: 'BasicTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { configSchemaFactory } from './configSchema'
export { stateModelFactory } from './model'

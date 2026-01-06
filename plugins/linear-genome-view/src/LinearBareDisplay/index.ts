import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'
import { BaseLinearDisplayComponent } from '../BaseLinearDisplay//index.ts'

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

export { configSchemaFactory } from './configSchema.ts'
export { stateModelFactory } from './model.ts'

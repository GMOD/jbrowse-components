import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLinearWiggleDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'MultiLinearWiggleDisplay',
        displayName: 'Multi-Wiggle display',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'MultiQuantitativeTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )
}

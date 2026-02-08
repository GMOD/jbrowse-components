import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearPileupDisplay',
      displayName: 'Pileup display',
      helpText:
        'Display stacked aligned reads showing exact placement and sequences relative to the reference genome',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { default as linearPileupDisplayStateModelFactory } from './model.ts'
export { default as linearPileupDisplayConfigSchemaFactory } from './configSchema.ts'
export { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin.ts'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import configSchemaFactory from './configSchema'
import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearPileupDisplay',
      displayName: 'Pileup display',
      configSchema,
      stateModel: modelFactory(configSchema),
      subDisplay: { type: 'LinearAlignmentsDisplay', lowerPanel: true },
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}

export { default as linearPileupDisplayStateModelFactory } from './model'
export { default as linearPileupDisplayConfigSchemaFactory } from './configSchema'
export { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin'

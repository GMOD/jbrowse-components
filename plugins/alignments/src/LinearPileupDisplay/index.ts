import configSchemaFactory from './configSchema'
import modelFactory from './model'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: BaseLinearDisplayComponent,
      configSchema,
      displayName: 'Pileup display',
      name: 'LinearPileupDisplay',
      stateModel: modelFactory(configSchema),
      subDisplay: { lowerPanel: true, type: 'LinearAlignmentsDisplay' },
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
    })
  })
}

export { default as linearPileupDisplayStateModelFactory } from './model'
export { default as linearPileupDisplayConfigSchemaFactory } from './configSchema'
export { SharedLinearPileupDisplayMixin } from './SharedLinearPileupDisplayMixin'

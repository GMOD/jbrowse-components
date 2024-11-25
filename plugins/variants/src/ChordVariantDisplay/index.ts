import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseChordDisplayComponent } from '@jbrowse/plugin-circular-view'

// locals
import configSchemaF from './models/configSchema'
import stateModelF from './models/stateModelFactory'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChordVariantDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      name: 'ChordVariantDisplay',
      displayName: 'Chord variant display',
      configSchema,
      stateModel,
      trackType: 'VariantTrack',
      viewType: 'CircularView',
      ReactComponent: BaseChordDisplayComponent,
    })
  })
}

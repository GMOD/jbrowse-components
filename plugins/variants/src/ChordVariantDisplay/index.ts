import PluginManager from '@jbrowse/core/PluginManager'
import { BaseChordDisplayComponent } from '@jbrowse/plugin-circular-view'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import configSchemaF from './models/configSchema'
import stateModelF from './models/stateModelFactory'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      ReactComponent: BaseChordDisplayComponent,
      configSchema,
      displayName: 'Chord variant display',
      name: 'ChordVariantDisplay',
      stateModel,
      trackType: 'VariantTrack',
      viewType: 'CircularView',
    })
  })
}

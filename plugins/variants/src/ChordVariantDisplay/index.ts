import PluginManager from '@jbrowse/core/PluginManager'
import { BaseChordDisplayComponent } from '@jbrowse/plugin-circular-view'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import configSchemaF from './models/configSchema'
import stateModelF from './models/stateModelFactory'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      name: 'ChordVariantDisplay',
      configSchema,
      stateModel,
      trackType: 'VariantTrack',
      viewType: 'CircularView',
      ReactComponent: BaseChordDisplayComponent,
    })
  })
}

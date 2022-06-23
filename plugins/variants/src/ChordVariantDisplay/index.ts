import PluginManager from '@jbrowse/core/PluginManager'
import { BaseChordDisplayComponent } from '@jbrowse/plugin-circular-view'
import ChordVariantDisplay from './models/ChordVariantDisplay'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

export default (pluginManager: PluginManager) => {
  const { load } = pluginManager

  const { stateModel, configSchema } = load(ChordVariantDisplay)

  return new DisplayType({
    name: 'ChordVariantDisplay',
    configSchema,
    stateModel,
    trackType: 'VariantTrack',
    viewType: 'CircularView',
    ReactComponent: BaseChordDisplayComponent,
  })
}

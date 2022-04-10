import PluginManager from '@jbrowse/core/PluginManager'
import { BaseChordDisplayComponent } from '@jbrowse/plugin-circular-view'
import ChordVariantDisplay from './models/ChordVariantDisplay'

export default (pluginManager: PluginManager) => {
  const { lib, load } = pluginManager
  const DisplayType = lib['@jbrowse/core/pluggableElementTypes/DisplayType']

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

import PluginManager from '@gmod/jbrowse-core/PluginManager'
import StructuralVariantChordTrack from './models/StructuralVariantChordTrack'

export default ({ lib, load }: PluginManager) => {
  const TrackType = lib['@gmod/jbrowse-core/pluggableElementTypes/TrackType']

  const { stateModel, configSchema } = load(StructuralVariantChordTrack)

  return new TrackType({
    name: 'StructuralVariantChordTrack',
    stateModel,
    configSchema,
    compatibleView: 'CircularView',
  })
}

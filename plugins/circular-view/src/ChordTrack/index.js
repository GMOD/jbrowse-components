import ChordTrackComponentFactory from './components/ChordTrack'
import ChordTrackModelFactory from './models/ChordTrack'

export default ({ jbrequire }) => {
  const TrackType = jbrequire('@jbrowse/core/pluggableElementTypes/TrackType')

  const ReactComponent = jbrequire(ChordTrackComponentFactory)
  const { stateModel, configSchema } = jbrequire(ChordTrackModelFactory)

  return new TrackType({
    name: 'ChordTrack',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

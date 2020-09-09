export default ({ jbrequire }) => {
  const TrackType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/TrackType',
  )

  const ReactComponent = jbrequire(require('./components/ChordTrack'))
  const { stateModel, configSchema } = jbrequire(require('./models/ChordTrack'))

  return new TrackType({
    name: 'ChordTrack',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

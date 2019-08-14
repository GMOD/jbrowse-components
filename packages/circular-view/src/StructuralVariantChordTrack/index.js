export default ({ jbrequire }) => {
  const TrackType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/TrackType',
  )

  const ReactComponent = jbrequire(require('./components'))
  const { stateModel, configSchema } = jbrequire(require('./models'))

  return new TrackType({
    name: 'StructuralVariantChordTrack',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

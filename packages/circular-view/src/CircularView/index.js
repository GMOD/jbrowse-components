export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/CircularView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/CircularView'),
  )

  return new ViewType({
    name: 'CircularView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

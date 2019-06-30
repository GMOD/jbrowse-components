export default pluginManager => {
  const { jbrequire } = pluginManager
  const ReactComponent = jbrequire(require('./components/CircularView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/CircularView'),
  )
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  return new ViewType({
    name: 'CircularView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

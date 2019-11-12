export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/SvInspectorView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/SvInspectorView'),
  )

  return new ViewType({
    name: 'SvInspectorView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

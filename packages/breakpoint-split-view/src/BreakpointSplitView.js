export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/BreakpointSplitView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/BreakpointSplitView'),
  )

  return new ViewType({
    name: 'BreakpointSplitView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

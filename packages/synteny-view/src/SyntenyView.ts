export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/SyntenyView'))
  const { stateModel, configSchema } = jbrequire(require('./model'))

  return new ViewType({
    name: 'BreakpointSplitView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

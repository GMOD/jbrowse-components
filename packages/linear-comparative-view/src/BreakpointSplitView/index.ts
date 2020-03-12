export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  return new ViewType({
    name: 'BreakpointSplitView',
    stateModel: jbrequire(require('./model')),
    ReactComponent: jbrequire(
      require('../LinearComparativeView/components/LinearComparativeView'),
    ),
  })
}

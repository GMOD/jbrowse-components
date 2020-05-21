export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )
  return new ViewType({
    name: 'LinearComparativeView',
    stateModel: jbrequire(require('./model')),
    ReactComponent: jbrequire(require('./components/LinearComparativeView')),
  })
}

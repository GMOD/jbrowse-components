export default ({ jbrequire }: { jbrequire: Function }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const stateModel = jbrequire(require('./model'))

  return new ViewType({
    name: 'LinearComparativeView',
    stateModel,
    ReactComponent: jbrequire(require('./components/LinearComparativeView')),
  })
}

export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/CircularView'))
  const { stateModel } = jbrequire(require('./models/CircularView'))

  return new ViewType({ name: 'CircularView', stateModel, ReactComponent })
}

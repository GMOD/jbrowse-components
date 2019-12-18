export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/SpreadsheetView'))
  const { stateModel } = jbrequire(require('./models/SpreadsheetView'))

  return new ViewType({ name: 'SpreadsheetView', stateModel, ReactComponent })
}

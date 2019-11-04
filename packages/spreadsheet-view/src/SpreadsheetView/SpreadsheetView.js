export default ({ jbrequire }) => {
  const ViewType = jbrequire(
    '@gmod/jbrowse-core/pluggableElementTypes/ViewType',
  )

  const ReactComponent = jbrequire(require('./components/SpreadsheetView'))
  const { stateModel, configSchema } = jbrequire(
    require('./models/SpreadsheetView'),
  )

  return new ViewType({
    name: 'SpreadsheetView',
    stateModel,
    configSchema,
    ReactComponent,
  })
}

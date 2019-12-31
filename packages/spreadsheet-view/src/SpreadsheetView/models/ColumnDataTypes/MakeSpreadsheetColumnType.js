export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  /** utility function for assembling the MST model of a column data type */
  function MakeSpreadsheetColumnType(
    name,
    {
      DataCellReactComponent = null,
      FilterModelType = null,
      compare,
      displayName = undefined,
    },
  ) {
    return types
      .model(`ColumnDataType${name}`, {
        type: types.literal(name),
      })
      .volatile(() => ({
        DataCellReactComponent,
        FilterModelType,
        displayName: displayName || name,
      }))
      .views(() => ({
        compare,
        get hasFilter() {
          return !!FilterModelType
        },
      }))
  }

  return MakeSpreadsheetColumnType
}

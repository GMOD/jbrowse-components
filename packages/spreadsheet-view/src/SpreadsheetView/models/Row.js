export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const DataType = types.enumeration('SpreadsheetDataType', ['text'])

  const CellModel = types
    .model('SpreadsheetCell', {
      columnNumber: types.number,
      text: types.string,
      dataType: DataType,
      extendedData: types.maybe(types.frozen()),
    })
    .views(self => ({
      // TODO: will probably want to make a view here called 'value' that parses
      // the cell's text in context of the schema
    }))

  const RowModel = types
    .model('SpreadsheetRow', {
      cells: types.array(CellModel),
      isSelected: false,
    })
    .actions(self => ({
      toggleSelect() {
        self.isSelected = !self.isSelected
      },
    }))

  return RowModel
}

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const CellModel = types
    .model('SpreadsheetCell', {
      columnNumber: types.number,
      text: types.string,
      extendedData: types.maybe(types.frozen()),
      // if this cell is derived from other cells, execute this function to get the value
      derivationFunction: types.maybe(types.frozen()),
    })
    .views(self => ({
      get value() {
        if (self.derivationFunction) return self.derivationFunction(self)
        return self.text
      },
    }))

  const RowModel = types
    .model('SpreadsheetRow', {
      id: types.identifier,
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

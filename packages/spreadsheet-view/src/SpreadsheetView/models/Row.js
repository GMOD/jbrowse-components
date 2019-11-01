export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const CellModel = types
    .model('SpreadsheetCell', {
      text: types.string,
      extendedData: types.maybe(types.frozen()),
    })
    .views(self => ({}))

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

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const CellModel = types.model('SpreadsheetCell', {
    text: types.string,
    extendedData: types.maybe(types.frozen()),
  })

  const RowModel = types
    .model('SpreadsheetRow', {
      id: types.identifier,
      cells: types.array(CellModel),
      extendedData: types.maybe(types.frozen()),
      isSelected: false,
    })
    .actions(self => ({
      toggleSelect() {
        self.isSelected = !self.isSelected
      },
      unSelect() {
        self.isSelected = false
      },
      select() {
        self.isSelected = true
      },
    }))

  return RowModel
}

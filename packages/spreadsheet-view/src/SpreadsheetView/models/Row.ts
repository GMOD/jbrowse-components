import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) => {
  const { lib } = pluginManager
  const { types, getParent } = lib['mobx-state-tree']

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
      setExtendedData(data: unknown) {
        self.extendedData = data
      },
    }))
    .views(self => ({
      get cellsWithDerived() {
        const { columns } = getParent(self, 3)
        let i = 0
        return columns.map((column: { isDerived: boolean; func: Function }) => {
          console.log({ column, der: column.isDerived })
          if (column.isDerived) {
            return column.func(self, column)
          }
          return self.cells[i++]
        })
      },
    }))

  return RowModel
}

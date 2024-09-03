import { types, getParent } from 'mobx-state-tree'

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
      const { columns } = getParent<any>(self, 3)
      let i = 0

      return columns.map((column: { isDerived: boolean; expr: any }) => {
        if (column.isDerived) {
          return column.expr.evalSync({
            row: self,
          })
        }
        return self.cells[i++]
      })
    },
  }))

export default RowModel

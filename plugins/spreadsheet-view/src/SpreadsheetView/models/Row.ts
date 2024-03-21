import { types, getParent } from 'mobx-state-tree'

const CellModel = types.model('SpreadsheetCell', {
  extendedData: types.maybe(types.frozen()),
  text: types.string,
})

const RowModel = types
  .model('SpreadsheetRow', {
    cells: types.array(CellModel),
    extendedData: types.maybe(types.frozen()),
    id: types.identifier,
    isSelected: false,
  })
  .actions(self => ({
    select() {
      self.isSelected = true
    },
    setExtendedData(data: unknown) {
      self.extendedData = data
    },
    toggleSelect() {
      self.isSelected = !self.isSelected
    },
    unSelect() {
      self.isSelected = false
    },
  }))
  .views(self => ({
    get cellsWithDerived() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { columns } = getParent<any>(self, 3)
      let i = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

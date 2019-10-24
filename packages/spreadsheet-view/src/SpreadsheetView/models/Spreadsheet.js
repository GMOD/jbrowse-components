export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent } = jbrequire('mobx-state-tree')

  const DataTypes = jbrequire(require('./ColumnDataTypes'))

  const StaticRowSetModel = jbrequire(require('./StaticRowSet'))

  const stateModel = types
    .model('Spreadsheet', {
      rowSet: types.optional(StaticRowSetModel, () =>
        StaticRowSetModel.create(),
      ),
      columns: types.array(
        types.model('ColumnDefinition', {
          name: types.maybe(types.string),
          dataType: types.optional(DataTypes.Any, () => ({
            type: 'Text',
          })),
        }),
      ),
      columnDisplayOrder: types.array(types.number),
      hasColumnNames: false,

      sortColumns: types.array(
        types.model('SortColumns', {
          columnNumber: types.number,
          descending: false,
        }),
      ),
    })
    .volatile(self => ({
      defaultDataType: DataTypes.Text,
    }))
    .views(self => ({
      get hideRowSelection() {
        // just delegates to parent
        return getParent(self).hideRowSelection
      },

      rowSortingComparisonFunction(rowA, rowB) {
        for (let i = 0; i < self.sortColumns.length; i += 1) {
          const { columnNumber, descending } = self.sortColumns[i]
          const { dataType } = self.columns.get(columnNumber)
          const result = dataType.compare(
            rowA.cells[columnNumber],
            rowB.cells[columnNumber],
          )
          if (result) return descending ? -result : result
        }
        return 0
      },
    }))
    .actions(self => ({
      setSortColumns(newSort) {
        self.sortColumns = newSort
      },
    }))

  return stateModel
}

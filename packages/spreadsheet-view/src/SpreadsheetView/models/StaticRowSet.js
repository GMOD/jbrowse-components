export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent } = jbrequire('mobx-state-tree')
  const RowModel = jbrequire(require('./Row'))

  return types
    .model('StaticRowSet', {
      isLoaded: types.literal(true),
      rows: types.array(RowModel),
    })
    .views(self => ({
      get count() {
        return self.rows.length
      },

      get passingFiltersCount() {
        return self.sortedFilteredRows.length
      },

      get sortedRows() {
        const parent = getParent(self)
        return self.rows.slice().sort(parent.rowSortingComparisonFunction)
      },

      get selectedRows() {
        return self.rows.filter(r => r.isSelected)
      },

      get selectedFilteredRows() {
        const sheet = getParent(self)
        const view = getParent(sheet)
        const { filterControls } = view
        return self.selectedRows.filter(row =>
          filterControls.rowPassesFilters(sheet, row),
        )
      },

      // the set of all rows that pass the filters, sorted
      get sortedFilteredRows() {
        const sheet = getParent(self)
        const view = getParent(sheet)
        const { filterControls } = view
        return self.rows
          .filter(row => filterControls.rowPassesFilters(sheet, row))
          .sort(sheet.rowSortingComparisonFunction)
      },
    }))
}

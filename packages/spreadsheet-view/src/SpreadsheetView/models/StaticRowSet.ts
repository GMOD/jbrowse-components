import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Row from './Row'

export default (pluginManager: PluginManager) => {
  const { lib, load } = pluginManager
  const { types, getParent } = lib['mobx-state-tree']
  const RowModel = load(Row)

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
        return this.sortedFilteredRows.length
      },

      get selectedCount() {
        return this.selectedRows.length
      },

      get selectedAndPassingFiltersCount() {
        return this.selectedFilteredRows.length
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
        return this.selectedRows.filter(row =>
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
    .actions(self => ({
      unselectAll() {
        self.rows.forEach(row => row.unSelect())
      },
    }))
}

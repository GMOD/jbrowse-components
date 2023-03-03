import RowModel from './Row'
import { types, getParent } from 'mobx-state-tree'

const StaticRowModel = types
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = getParent<any>(self)
      return [...self.rows].sort(parent.rowSortingComparisonFunction)
    },

    get selectedRows() {
      return self.rows.filter(r => r.isSelected)
    },

    get selectedFilteredRows() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sheet = getParent<any>(self)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = getParent<any>(sheet)
      const { filterControls } = view
      return this.selectedRows.filter(row =>
        filterControls.rowPassesFilters(sheet, row),
      )
    },

    // the set of all rows that pass the filters, sorted
    get sortedFilteredRows() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sheet = getParent<any>(self)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = getParent<any>(sheet)
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

export default StaticRowModel

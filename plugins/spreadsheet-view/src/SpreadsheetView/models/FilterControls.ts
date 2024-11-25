import { types, getParent } from 'mobx-state-tree'
import { AnyFilterModelType as AnyColumnFilter } from './ColumnDataTypes'
import type { SnapshotIn } from 'mobx-state-tree'

// filter that finds a simple string in any of the cells of a row
const RowFullTextFilter = types
  .model('RowFullTextFilter', {
    type: types.literal('RowFullText'),
    stringToFind: '',
  })
  .views(self => ({
    // returns a function that tests the given row
    get predicate() {
      let s = self.stringToFind // avoid closing over self
      if (!s) {
        return function alwaysTrue() {
          return true
        }
      }
      s = s.toLowerCase()
      return function stringPredicate(
        _sheet: unknown,
        row: { cellsWithDerived: { text: string }[] },
      ) {
        const { cellsWithDerived } = row
        for (const cell of cellsWithDerived) {
          // note: case insensitive
          if (cell.text.toLowerCase().includes(s)) {
            return true
          }
        }
        return false
      }
    },
  }))
  .actions(self => ({
    setString(s: string) {
      self.stringToFind = s
    },
    clear() {
      self.stringToFind = ''
    },
  }))

const model = types
  .model('SpreadsheetFilterControls', {
    rowFullText: types.optional(
      RowFullTextFilter,
      () =>
        ({
          type: 'RowFullText',
          stringToFind: '',
        }) as SnapshotIn<typeof RowFullTextFilter>,
    ),
    columnFilters: types.array(AnyColumnFilter),
  })
  .views(self => ({
    get filters() {
      return [self.rowFullText, ...self.columnFilters].filter(f => !!f)
    },
    setRowFullTextFilter(stringToFind: string) {
      // @ts-expect-error
      self.rowFullText = {
        type: 'RowFullText',
        stringToFind,
      }
    },
    rowPassesFilters(sheet: unknown, row: unknown) {
      for (const filter of this.filters) {
        if (!filter.predicate(sheet, row)) {
          return false
        }
      }
      return true
    },
  }))
  .actions(self => ({
    addBlankColumnFilter(columnNumber: number) {
      const { dataType } =
        getParent<any>(self).spreadsheet.columns[columnNumber]
      self.columnFilters.push({
        type: dataType.type,
        columnNumber,
      })
    },
    removeColumnFilter(filter: typeof AnyColumnFilter) {
      return self.columnFilters.remove(filter)
    },
    clearAllFilters() {
      self.columnFilters.clear()
      self.rowFullText.clear()
    },
  }))

export default model

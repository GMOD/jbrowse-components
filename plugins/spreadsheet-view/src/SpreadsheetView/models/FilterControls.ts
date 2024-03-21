import { types, getParent, SnapshotIn } from 'mobx-state-tree'
import { AnyFilterModelType as AnyColumnFilter } from './ColumnDataTypes'

// filter that finds a simple string in any of the cells of a row
const RowFullTextFilter = types
  .model('RowFullTextFilter', {
    stringToFind: '',
    type: types.literal('RowFullText'),
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
          if (cell.text && cell.text.toLowerCase().includes(s)) {
            return true
          }
        }
        return false
      }
    },
  }))
  .actions(self => ({
    clear() {
      self.stringToFind = ''
    },
    setString(s: string) {
      self.stringToFind = s
    },
  }))

const model = types
  .model('SpreadsheetFilterControls', {
    columnFilters: types.array(AnyColumnFilter),
    rowFullText: types.optional(
      RowFullTextFilter,
      () =>
        ({
          stringToFind: '',
          type: 'RowFullText',
        }) as SnapshotIn<typeof RowFullTextFilter>,
    ),
  })
  .views(self => ({
    get filters() {
      return [self.rowFullText, ...self.columnFilters].filter(f => !!f)
    },
    rowPassesFilters(sheet: unknown, row: unknown) {
      for (const filter of this.filters) {
        if (!filter.predicate(sheet, row)) {
          return false
        }
      }
      return true
    },
    setRowFullTextFilter(stringToFind: string) {
      // @ts-expect-error
      self.rowFullText = {
        stringToFind,
        type: 'RowFullText',
      }
    },
  }))
  .actions(self => ({
    addBlankColumnFilter(columnNumber: number) {
      const { dataType } =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getParent<any>(self).spreadsheet.columns[columnNumber]
      self.columnFilters.push({
        columnNumber,
        type: dataType.type,
      })
    },
    clearAllFilters() {
      self.columnFilters.clear()
      self.rowFullText.clear()
    },
    removeColumnFilter(filter: typeof AnyColumnFilter) {
      return self.columnFilters.remove(filter)
    },
  }))

export default model

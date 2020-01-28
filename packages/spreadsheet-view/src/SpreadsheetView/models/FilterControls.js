export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent } = jbrequire('mobx-state-tree')

  const { AnyFilterModelType: AnyColumnFilter } = jbrequire(
    require('./ColumnDataTypes'),
  )

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
        if (!s)
          return function alwaysTrue() {
            return true
          }
        s = s.toLowerCase()
        return function stringPredicate(sheet, row) {
          const { cells } = row
          for (
            let columnNumber = 0;
            columnNumber < cells.length;
            columnNumber += 1
          ) {
            const cell = cells[columnNumber]
            // TODO: add support for derived cells
            // note: case insensitive
            if (cell.text && cell.text.toLowerCase().indexOf(s) !== -1)
              return true
          }
          return false
        }
      },
    }))
    .actions(self => ({
      setString(s) {
        self.stringToFind = s
      },
      clear() {
        self.stringToFind = ''
      },
    }))

  return types
    .model('SpreadsheetFilterControls', {
      rowFullText: types.optional(RowFullTextFilter, () => ({
        type: 'RowFullText',
      })),
      columnFilters: types.array(AnyColumnFilter),
    })
    .views(self => ({
      get filters() {
        return [self.rowFullText, ...self.columnFilters].filter(f => !!f)
      },
      setRowFullTextFilter(stringToFind) {
        self.rowFullText = { type: 'RowFullText', stringToFind }
      },
      rowPassesFilters(sheet, row) {
        for (let i = 0; i < self.filters.length; i += 1) {
          if (!self.filters[i].predicate(sheet, row)) return false
        }
        return true
      },
    }))
    .actions(self => ({
      addBlankColumnFilter(columnNumber) {
        const { dataType } = getParent(self).spreadsheet.columns[columnNumber]
        self.columnFilters.push({
          type: dataType.type,
          columnNumber,
        })
      },
      removeColumnFilter(filter) {
        return self.columnFilters.remove(filter)
      },
      clearAllFilters() {
        self.columnFilters.clear()
        self.rowFullText.clear()
      },
    }))
}

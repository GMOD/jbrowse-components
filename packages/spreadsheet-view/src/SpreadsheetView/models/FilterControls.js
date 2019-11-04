export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  // filter that finds a simple string in any of the cells of a row
  const TextFilter = types
    .model('TextFilter', {
      type: types.literal('Text'),
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
    }))

  const FilterTypes = types.union(TextFilter)
  return types
    .model('SpreadsheetFilterControls', {
      filters: types.array(FilterTypes),
    })
    .views(self => ({
      setFilters(filters) {
        self.filters = filters
      },
      rowPassesFilters(sheet, row) {
        for (let i = 0; i < self.filters.length; i += 1) {
          if (!self.filters[i].predicate(sheet, row)) return false
        }
        return true
      },
    }))
}

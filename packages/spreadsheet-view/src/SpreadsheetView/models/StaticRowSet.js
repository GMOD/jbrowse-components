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

      get sortedRows() {
        const parent = getParent(self)
        return self.rows.slice().sort(parent.rowSortingComparisonFunction)
      },

      get selectedRows() {
        return self.rows.filter(r => r.isSelected)
      },
    }))
}

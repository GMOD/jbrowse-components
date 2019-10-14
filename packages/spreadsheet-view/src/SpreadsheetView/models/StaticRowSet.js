export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')
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

      getRows(startRowNum, endRowNum) {
        return Promise.resolve(self.rows.slice(startRowNum, endRowNum + 1))
      },
    }))
}

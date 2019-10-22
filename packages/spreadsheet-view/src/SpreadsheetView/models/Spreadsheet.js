export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, readConfObject } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )

  const StaticRowSetModel = jbrequire(require('./StaticRowSet'))

  const stateModel = types
    .model('Spreadsheet', {
      rowSet: types.optional(StaticRowSetModel, () =>
        StaticRowSetModel.create(),
      ),
      columnDisplayOrder: types.array(types.number),
      columnNames: types.map(types.string),
      hasColumnNames: false,
    })
    .views(self => ({
      get hideRowSelection() {
        // just delegates to parent
        return getParent(self).hideRowSelection
      },
    }))
    .actions(self => ({}))

  return stateModel
}

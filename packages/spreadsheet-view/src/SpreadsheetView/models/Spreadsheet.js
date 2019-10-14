export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { ElementId, Region } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema, readConfObject } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const { clamp, getSession } = jbrequire('@gmod/jbrowse-core/util')

  const StaticRowSetModel = jbrequire(require('./StaticRowSet'))

  const stateModel = types
    .model('Spreadsheet', {
      rows: types.optional(StaticRowSetModel, () => StaticRowSetModel.create()),
      columnDisplayOrder: types.array(types.number),
    })
    .views(self => ({}))
    .actions(self => ({}))

  return stateModel
}

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types, getParent } = jbrequire('mobx-state-tree')

  const DataTypes = jbrequire(require('./ColumnDataTypes'))

  const StaticRowSetModel = jbrequire(require('./StaticRowSet'))

  const stateModel = types
    .model('Spreadsheet', {
      rowSet: types.optional(StaticRowSetModel, () =>
        StaticRowSetModel.create(),
      ),
      columnDisplayOrder: types.array(types.number),
      columnNames: types.map(types.string),
      columnDataTypes: types.map(DataTypes.Any),
      hasColumnNames: false,
    })
    .volatile(self => ({
      defaultDataType: DataTypes.Text,
    }))
    .views(self => ({
      get hideRowSelection() {
        // just delegates to parent
        return getParent(self).hideRowSelection
      },
    }))
    .actions(self => ({}))

  return stateModel
}

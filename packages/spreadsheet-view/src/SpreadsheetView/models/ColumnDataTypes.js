export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const DataTypes = {}

  function ColumnDataType(name, { ReactComponent = null, compare }) {
    DataTypes[name] = types
      .model(`ColumnDataType${name}`, { type: types.literal(name) })
      .volatile(self => ({ ReactComponent }))
      .views(() => ({ compare }))
  }

  ColumnDataType('Text', {
    compare(a, b) {
      return a.localeCompare(b)
    },
  })

  ColumnDataType('Number', {
    compare(a, b) {
      return a - b
    },
  })

  DataTypes.Any = types.union(...Object.values(DataTypes))

  return DataTypes
}

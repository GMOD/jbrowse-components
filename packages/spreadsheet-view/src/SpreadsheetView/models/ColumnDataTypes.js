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
    compare(cellA, cellB) {
      return cellA.text.localeCompare(cellB.text)
    },
  })

  ColumnDataType('Number', {
    compare(cellA, cellB) {
      return parseFloat(cellA.text, 10) - parseFloat(cellB.text, 10)
    },
  })

  // ColumnDataType('VcfInfo', {
  //   ReactComponent: VCFInfoColumn,
  //   SortMenuItem: VCFInfoSortMenuItem,
  //   compare(a, b) {},
  // })

  DataTypes.Any = types.union(...Object.values(DataTypes))

  return DataTypes
}

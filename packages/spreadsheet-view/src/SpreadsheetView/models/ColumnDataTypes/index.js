export default pluginManager => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const { NumberColumn: Number } = jbrequire(require('./Number'))
  const { TextColumn: Text } = jbrequire(require('./Text'))

  const DataTypes = {
    ColumnTypes: {
      Number,
      Text,
      LocString: jbrequire(require('./LocString')),
      LocRef: jbrequire(require('./LocRef')),
      LocStart: jbrequire(require('./LocStart')),
      LocEnd: jbrequire(require('./LocEnd')),
    },
  }

  const allColumnTypes = Object.values(DataTypes.ColumnTypes)
  DataTypes.AnyColumnType = types.union(...allColumnTypes)

  // make a type union of all the different filter model types
  DataTypes.AnyFilterModelType = types.union(
    ...allColumnTypes
      .map(columnType => {
        // just instantiate the blank types to get their filter model types
        const { FilterModelType } = columnType.create({
          type: columnType.properties.type.value,
        })
        return FilterModelType
      })
      // some column types might not have filter machinery, filter those out
      .filter(t => !!t),
  )

  return DataTypes
}

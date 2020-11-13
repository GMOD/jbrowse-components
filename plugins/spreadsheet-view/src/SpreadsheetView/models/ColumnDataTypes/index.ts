import PluginManager from '@jbrowse/core/PluginManager'
import LocStringFactory from './LocString'
import LocRefFactory from './LocRef'
import LocStartFactory from './LocStart'
import LocEndFactory from './LocEnd'
import NumberFactory from './Number'
import TextFactory from './Text'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  const { NumberColumn: Number } = jbrequire(NumberFactory)
  const { TextColumn: Text } = jbrequire(TextFactory)

  const ColumnTypes = {
    Number,
    Text,
    LocString: jbrequire(LocStringFactory),
    LocRef: jbrequire(LocRefFactory),
    LocStart: jbrequire(LocStartFactory),
    LocEnd: jbrequire(LocEndFactory),
  }

  const allColumnTypes = Object.values(ColumnTypes)
  const AnyColumnType = types.union(...allColumnTypes)

  return Object.freeze({
    ColumnTypes,
    AnyColumnType,
    // make a type union of all the different filter model types
    AnyFilterModelType: types.union(
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
    ),
  })
}

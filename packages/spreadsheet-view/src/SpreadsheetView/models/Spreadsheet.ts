import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { SnapshotIn, Instance } from 'mobx-state-tree'
import ColumnDataTypes from './ColumnDataTypes'
import StaticRowSetF from './StaticRowSet'
import RowF from './Row'

export default (pluginManager: PluginManager) => {
  const { lib, load } = pluginManager
  const { types, getParent } = lib['mobx-state-tree']

  const { ColumnTypes, AnyColumnType } = load(ColumnDataTypes)

  const StaticRowSetModel = load(StaticRowSetF)
  type Row = Instance<ReturnType<typeof RowF>>

  const ColumnDefinition = types
    .model('ColumnDefinition', {
      name: types.maybe(types.string),
      dataType: types.optional(AnyColumnType, () => ({
        type: 'Text',
      })),
      // set to true if column is derived from other columns
      // if the column is derived, each cell will have a
      // `derivationFunction` that is called to get its value
      isDerived: false,
      // if this cell is derived from other cells, execute this function to get the value
      derivationFunctionText: types.maybe(types.string),
    })
    .views(self => ({
      get func() {
        if (self.isDerived) {
          // compile this as a function
          return stringToFunction(String(self.derivationFunctionText))
        }
        return undefined
      },
    }))

  const stateModel = types
    .model('Spreadsheet', {
      rowSet: types.optional(StaticRowSetModel, () =>
        StaticRowSetModel.create(),
      ),
      columns: types.array(ColumnDefinition),
      columnDisplayOrder: types.array(types.number),
      hasColumnNames: false,

      sortColumns: types.array(
        types
          .model('SortColumns', {
            columnNumber: types.number,
            descending: false,
          })
          .actions(self => ({
            switchDirection() {
              self.descending = !self.descending
            },
          })),
      ),

      assemblyName: types.maybe(types.string),
    })
    .volatile(() => ({
      defaultDataType: ColumnTypes.Text,
    }))
    .views(self => ({
      get hideRowSelection() {
        // just delegates to parent
        return getParent(self).hideRowSelection
      },

      // list of data type names to be made available in the column
      // dropdown menu
      get dataTypeChoices() {
        const typeNames = Object.keys(
          ColumnTypes,
        ) as (keyof typeof ColumnTypes)[]
        return typeNames.map(typeName => {
          const dataType = ColumnTypes[typeName].create({ type: typeName })
          const { displayName, categoryName } = dataType
          return { typeName, displayName, categoryName }
        })
      },

      rowSortingComparisonFunction(rowA: Row, rowB: Row) {
        for (let i = 0; i < self.sortColumns.length; i += 1) {
          const { columnNumber, descending } = self.sortColumns[i]
          const { dataType } = self.columns[columnNumber]
          const result = dataType.compare(
            rowA.cells[columnNumber],
            rowB.cells[columnNumber],
          )
          if (result) return descending ? -result : result
        }
        return 0
      },
    }))
    .actions(self => ({
      setSortColumns(
        newSort: NonNullable<SnapshotIn<typeof self.sortColumns>>,
      ) {
        // @ts-ignore
        if (newSort) self.sortColumns = newSort
      },
      setColumnType(columnNumber: number, newTypeName: string) {
        self.columns[columnNumber].dataType = { type: newTypeName }
      },
      unselectAll() {
        return self.rowSet.unselectAll()
      },
    }))

  return stateModel
}

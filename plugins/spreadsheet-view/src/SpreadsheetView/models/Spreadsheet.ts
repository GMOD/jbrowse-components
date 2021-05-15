import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { SnapshotIn, Instance, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import ColumnDataTypes from './ColumnDataTypes'
import StaticRowSetF from './StaticRowSet'
import RowF from './Row'

const SpreadsheetModelF = (pluginManager: PluginManager) => {
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
      get expr() {
        if (self.isDerived) {
          // compile this as a jexl expression
          return stringToJexlExpression(
            String(self.derivationFunctionText),
            pluginManager.jexl,
          )
        }
        return undefined
      },
    }))

  type RowMenuPosition = { anchorEl: Element; rowNumber: number } | null
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
      rowMenuPosition: null as RowMenuPosition,
      isLoaded: false,
    }))
    .views(self => ({
      get initialized() {
        const session = getSession(self)
        const name = self.assemblyName
        if (name) {
          const asm = session.assemblyManager.get(name)
          return asm && asm.initialized
        }
        return true
      },
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
            rowA.cellsWithDerived[columnNumber],
            rowB.cellsWithDerived[columnNumber],
          )
          if (result) {
            return descending ? -result : result
          }
        }
        return 0
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(async () => {
            const session = getSession(self)
            const { assemblyManager } = session
            try {
              if (self.assemblyName) {
                await assemblyManager.waitForAssembly(self.assemblyName)
                this.setLoaded(true)
              }
            } catch (error) {
              session.notify(
                `failed to load assembly ${self.assemblyName} ${error}`,
                'error',
              )
            }
          }),
        )
      },

      setLoaded(flag: boolean) {
        self.isLoaded = flag
      },

      setRowMenuPosition(newPosition: RowMenuPosition) {
        self.rowMenuPosition = newPosition
      },

      setSortColumns(
        newSort: NonNullable<SnapshotIn<typeof self.sortColumns>>,
      ) {
        if (newSort) {
          // @ts-ignore
          self.sortColumns = newSort
        }
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

export default SpreadsheetModelF

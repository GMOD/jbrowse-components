import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { getSession, getEnv } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import {
  addDisposer,
  types,
  getParent,
  SnapshotIn,
  Instance,
} from 'mobx-state-tree'

// locals
import { ColumnTypes, AnyColumnType } from './ColumnDataTypes'
import StaticRowSetModel from './StaticRowSet'
import RowModel from './Row'

type Row = Instance<typeof RowModel>

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
    // if this cell is derived from other cells, execute this function to get
    // the value
    derivationFunctionText: types.maybe(types.string),
  })
  .views(self => ({
    get expr() {
      if (self.isDerived) {
        // compile this as a jexl expression
        return stringToJexlExpression(
          String(self.derivationFunctionText),
          getEnv(self).pluginManager.jexl,
        )
      }
      return undefined
    },
  }))

type RowMenuPosition = { anchorEl: Element; rowNumber: string } | null

const Spreadsheet = types
  .model('Spreadsheet', {
    rowSet: types.optional(StaticRowSetModel, () => StaticRowSetModel.create()),
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
      return name ? session.assemblyManager.get(name)?.initialized : false
    },
    get hideRowSelection() {
      // just delegates to parent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return getParent<any>(self).hideRowSelection
    },

    // list of data type names to be made available in the column
    // dropdown menu
    get dataTypeChoices() {
      const typeNames = Object.keys(ColumnTypes) as (keyof typeof ColumnTypes)[]
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

    setSortColumns(newSort: NonNullable<SnapshotIn<typeof self.sortColumns>>) {
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

export type SpreadsheetStateModel = typeof Spreadsheet
export type SpreadsheetModel = Instance<SpreadsheetStateModel>

export default Spreadsheet

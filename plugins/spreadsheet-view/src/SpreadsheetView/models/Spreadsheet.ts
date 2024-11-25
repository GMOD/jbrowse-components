import { getSession, getEnv } from '@jbrowse/core/util'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { autorun } from 'mobx'
import { addDisposer, types, getParent } from 'mobx-state-tree'

// locals
import { ColumnTypes, AnyColumnType } from './ColumnDataTypes'
import StaticRowSetModel from './StaticRowSet'
import type RowModel from './Row'
import type { SnapshotIn, Instance } from 'mobx-state-tree'

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

/**
 * #stateModel SpreadsheetViewSpreadsheet
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Spreadsheet = types
  .model('Spreadsheet', {
    /**
     * #property
     */
    rowSet: types.optional(StaticRowSetModel, () => StaticRowSetModel.create()),
    /**
     * #property
     */
    columns: types.array(ColumnDefinition),
    /**
     * #property
     */
    columnDisplayOrder: types.array(types.number),
    /**
     * #property
     */
    hasColumnNames: false,
    /**
     * #property
     */
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
    /**
     * #getter
     */
    get initialized() {
      const session = getSession(self)
      const name = self.assemblyName
      return name ? session.assemblyManager.get(name)?.initialized : false
    },
    /**
     * #getter
     */
    get hideRowSelection() {
      // just delegates to parent

      return getParent<any>(self).hideRowSelection
    },

    /**
     * #getter
     * list of data type names to be made available in the column
     * dropdown menu
     */
    get dataTypeChoices() {
      const typeNames = Object.keys(ColumnTypes) as (keyof typeof ColumnTypes)[]
      return typeNames.map(typeName => {
        const dataType = ColumnTypes[typeName].create({ type: typeName })
        const { displayName, categoryName } = dataType
        return { typeName, displayName, categoryName }
      })
    },

    /**
     * #method
     */
    rowSortingComparisonFunction(rowA: Row, rowB: Row) {
      for (const { columnNumber, descending } of self.sortColumns) {
        const { dataType } = self.columns[columnNumber]!
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

    /**
     * #action
     */
    setLoaded(flag: boolean) {
      self.isLoaded = flag
    },

    /**
     * #action
     */
    setRowMenuPosition(newPosition: RowMenuPosition) {
      self.rowMenuPosition = newPosition
    },

    /**
     * #action
     */
    setSortColumns(newSort: NonNullable<SnapshotIn<typeof self.sortColumns>>) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (newSort) {
        // @ts-expect-error
        self.sortColumns = newSort
      }
    },

    /**
     * #action
     */
    setColumnType(columnNumber: number, newTypeName: string) {
      self.columns[columnNumber]!.dataType = { type: newTypeName }
    },

    /**
     * #action
     */
    unselectAll() {
      self.rowSet.unselectAll()
    },
  }))

export type SpreadsheetStateModel = typeof Spreadsheet
export type SpreadsheetModel = Instance<SpreadsheetStateModel>

export default Spreadsheet

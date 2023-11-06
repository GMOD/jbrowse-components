import React from 'react'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, types, Instance } from 'mobx-state-tree'

/**
 * #stateModel SpreadsheetViewSpreadsheet
 * #category view
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export interface SpreadsheetData {
  rows: Record<string, unknown>[]
  columns: string[]
  CustomComponents?: Record<
    string,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Component: React.FC<any>
      props: Record<string, unknown>
    }
  >
}

function stateModelFactory() {
  return types
    .model('Spreadsheet', {
      /**
       * #property
       */
      assemblyName: types.maybe(types.string),
    })
    .volatile(() => ({
      data: undefined as SpreadsheetData | undefined,
      visible: {} as Record<string, boolean>,
      widths: {} as Record<string, number>,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get initialized() {
        return !!self.data
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setVisible(args: Record<string, boolean>) {
        self.visible = args
      },
      /**
       * #action
       */
      setData(data?: SpreadsheetData, assemblyName?: string) {
        self.data = data
        self.assemblyName = assemblyName
      },
      /**
       * #action
       */
      setWidths(w: Record<string, number>) {
        self.widths = w
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get columns() {
        const { data, widths } = self
        return data?.columns.map(m => {
          const res = data.CustomComponents?.[m]
          return {
            field: m,
            width: widths[m],
            renderCell: res
              ? ({
                  value,
                  row,
                }: {
                  value?: string
                  row: Record<string, unknown>
                }) => (
                  <res.Component
                    value={value}
                    model={self}
                    row={row}
                    {...res.props}
                  />
                )
              : undefined,
          }
        })
      },
      /**
       * #getter
       */
      get widthList() {
        return Object.values(self.widths).map(f => f ?? 100)
      },
    }))

    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (self.data) {
              self.setVisible(
                Object.fromEntries(self.data.columns.map(c => [c, true])),
              )
            }
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            if (self.data) {
              const { rows, columns } = self.data
              const widths = Object.fromEntries(
                columns
                  .filter(f => self.visible[f])
                  .map(e => [e, measureGridWidth(rows.map(r => r[e]))]),
              )
              self.setWidths(widths)
            }
          }),
        )
      },
    }))
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>

export default stateModelFactory

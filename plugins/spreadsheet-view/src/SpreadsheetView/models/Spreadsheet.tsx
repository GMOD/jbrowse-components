import React from 'react'
import {
  Feature,
  assembleLocString,
  measureGridWidth,
} from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, types, Instance } from 'mobx-state-tree'

// locals
import FeatureMenu from '../importAdapters/components/FeatureMenu'
import { GridColDef } from '@mui/x-data-grid'
import LocString from '../importAdapters/components/LocString'

interface Row {
  feature: Feature
  [key: string]: unknown
}

interface ComponentRecord {
  Component: React.FC<any>
  props: Record<string, unknown>
}

export interface SpreadsheetData {
  rows: Row[]
  columns: string[]
  ColumnComponentMap?: Record<string, ComponentRecord>
}

/**
 * #stateModel SpreadsheetViewSpreadsheet
 * #category view
 */
function stateModelFactory() {
  return types
    .model('Spreadsheet', {
      /**
       * #property
       */
      assemblyName: types.maybe(types.string),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      data: undefined as SpreadsheetData | undefined,
      /**
       * #volatile
       */
      visibleColumns: {} as Record<string, boolean>,
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
      setVisibleColumns(args: Record<string, boolean>) {
        self.visibleColumns = args
      },
      /**
       * #action
       */
      setData(data?: SpreadsheetData, assemblyName?: string) {
        self.data = data
        self.assemblyName = assemblyName
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rows() {
        return (self.data?.rows.map(r => ({
          menu: 'a',
          loc: assembleLocString({
            refName: r.feature.get('refName'),
            start: r.feature.get('start'),
            end: r.feature.get('end'),
          }),
          ...r,
        })) || []) as Record<string, unknown>[]
      },
      /**
       * #getter
       */
      get features() {
        return self.data?.rows.map(r => r.feature)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get columns() {
        const { data } = self
        return [
          {
            field: 'menu',
            width: 10,
            renderCell: arg => (
              <FeatureMenu model={self} arg={arg} value={arg.value || ''} />
            ),
          },
          {
            field: 'loc',
            width: measureGridWidth(
              self.rows.map(r => r.loc),
              { minWidth: 20 },
            ),
            renderCell: arg => <LocString model={self} value={arg.value} />,
          },
          ...(data?.columns.map(m => {
            const res = data.ColumnComponentMap?.[m] as any
            return {
              field: m,
              renderCell: res,
              width: measureGridWidth(
                self.rows.map(r => r[m]),
                { minWidth: 20 },
              ),
            }
          }) || []),
        ] satisfies GridColDef[]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const { data } = self
            self.setVisibleColumns({
              loc: true,
              menu: true,
              ...Object.fromEntries(data?.columns.map(c => [c, true]) || []),
            })
          }),
        )
      },
    }))
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>

export default stateModelFactory

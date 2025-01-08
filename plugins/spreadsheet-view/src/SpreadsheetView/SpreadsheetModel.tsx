import {
  assembleLocStringFast,
  getSession,
  measureGridWidth,
  toLocale,
} from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

import LocationCell from './components/LocationCell'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { GridColDef } from '@mui/x-data-grid'
import type { Instance } from 'mobx-state-tree'

export interface Row {
  // optional feature per-row
  feature?: SimpleFeatureSerialized

  // new style: object with key->name values
  cellData?: Record<string, unknown>

  // old style: array of cells
  cells?: {
    text: unknown
  }[]
}

export interface RowSet {
  rows: Row[]
}

/**
 * #stateModel SpreadsheetViewSpreadsheet
 * #category view
 */
export default function stateModelFactory() {
  return types
    .model('Spreadsheet', {
      /**
       * #property
       */
      rowSet: types.frozen<RowSet | undefined>(),
      /**
       * #property
       */
      columns: types.frozen<{ name: string }[]>(),
      /**
       * #property
       */
      assemblyName: types.maybe(types.string),
      /**
       * #property
       */
      visibleColumns: types.frozen<Record<string, boolean>>(),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      isLoaded: false,
      /**
       * #volatile
       */
      visibleRowFlags: undefined as Record<number, boolean> | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rows() {
        return self.rowSet?.rows.map((row, i) => ({
          id: i,
          feature: row.feature,
          ...Object.fromEntries(
            self.columns.map((c, idx) => [
              c.name,
              row.cellData?.[c.name] ?? row.cells?.[idx]?.text,
            ]),
          ),
        }))
      },

      /**
       * #getter
       */
      get initialized() {
        const session = getSession(self)
        const name = self.assemblyName
        return name ? session.assemblyManager.get(name)?.initialized : false
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get dataGridColumns() {
        const { rows } = self
        return rows
          ? [
              {
                field: 'Location',
                width:
                  measureGridWidth(
                    rows.map(row =>
                      row.feature ? assembleLocStringFast(row.feature) : 0,
                    ),
                  ) + 40,
                renderCell: ({ row }) => {
                  const { feature } = row
                  return feature ? (
                    <LocationCell model={self} feature={feature} />
                  ) : (
                    'N/A'
                  )
                },
              } satisfies GridColDef<(typeof rows)[0]>,
              {
                field: 'Length',
                type: 'number',
                width: measureGridWidth(
                  rows.map(r =>
                    r.feature ? toLocale(r.feature.end - r.feature.start) : 0,
                  ),
                ),
                valueGetter: (
                  _val: unknown,
                  row: { feature?: SimpleFeatureSerialized },
                ) => {
                  return row.feature
                    ? row.feature.end - row.feature.start
                    : undefined
                },
                valueFormatter: arg => toLocale(arg),
              } satisfies GridColDef<(typeof rows)[0]>,

              ...self.columns.map(
                f =>
                  ({
                    field: f.name,
                    width: measureGridWidth(
                      // @ts-expect-error
                      [...rows.map(r => r[f.name]), f.name],
                      { minWidth: 20 },
                    ),
                  }) satisfies GridColDef<(typeof rows)[0]>,
              ),
            ]
          : undefined
      },
    }))
    .views(self => ({
      get visibleRows() {
        const { visibleRowFlags } = self
        return visibleRowFlags
          ? self.rows?.filter((f, idx) => !!visibleRowFlags[idx])
          : self.rows
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setVisibleRows(arg?: Record<number, boolean>) {
        self.visibleRowFlags = arg
      },
      /**
       * #action
       */
      setVisibleColumns(arg: Record<string, boolean>) {
        self.visibleColumns = arg
      },

      /**
       * #action
       */
      setLoaded(flag: boolean) {
        self.isLoaded = flag
      },

      /**
       * #afterattach
       */
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
            } catch (e) {
              console.error(e)
              session.notifyError(
                `Failed to load assembly ${self.assemblyName} ${e}`,
                e,
              )
            }
          }),
        )
      },
    }))
    .preProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return snap
        ? {
            ...snap,
            // @ts-expect-error no longer support derived columns
            columns: snap.columns.filter(f => !f.isDerived),
            rowSet: snap.rowSet
              ? {
                  ...snap.rowSet,
                  rows: snap.rowSet.rows.map(r => ({
                    ...r,
                    feature:
                      r.feature ??
                      // @ts-expect-error
                      (r.extendedData?.vcfFeature as SimpleFeatureSerialized),
                  })),
                }
              : undefined,
          }
        : snap
    })
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>

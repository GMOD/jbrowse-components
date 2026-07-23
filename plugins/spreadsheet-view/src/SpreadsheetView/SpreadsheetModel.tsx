import {
  assembleLocStringFast,
  getSession,
  measureGridWidth,
  toLocale,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import LocationCell from './components/LocationCell.tsx'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { GridColDef } from '@mui/x-data-grid'

export interface Row {
  feature?: SimpleFeatureSerialized
  cellData?: Record<string, unknown>
  // old snapshot format
  cells?: { text: unknown }[]
}

export interface RowSet {
  rows: Row[]
}

export interface GridRow {
  id: number
  feature?: SimpleFeatureSerialized
  [key: string]: unknown
}

/**
 * #stateModel SpreadsheetViewSpreadsheet
 * #internal sheet state reached only through SpreadsheetView, not an API a user
 * scripts against — kept out of the website docs
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
      visibleColumns: types.optional(
        types.frozen<Record<string, boolean>>(),
        {},
      ),
      /**
       * #property
       * selected value of the SVTYPE quick-filter dropdown (undefined = show
       * all); applied to the INFO.SVTYPE column when the imported data has one
       */
      svTypeFilter: types.maybe(types.string),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      visibleRowFlags: undefined as Record<number, boolean> | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rows(): GridRow[] | undefined {
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
        const { rowSet, assemblyName } = self
        return !!(
          rowSet &&
          assemblyName &&
          getSession(self).assemblyManager.get(assemblyName)?.initialized
        )
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
              } satisfies GridColDef,
              {
                field: 'Length',
                type: 'number',
                width: measureGridWidth(
                  rows.map(row => {
                    const { feature } = row
                    return feature ? feature.end - feature.start : 0
                  }),
                ),
                valueGetter: (
                  _val: unknown,
                  row: { feature?: SimpleFeatureSerialized },
                ) => {
                  const { feature } = row
                  return feature ? feature.end - feature.start : undefined
                },
                valueFormatter: arg => toLocale(arg),
              } satisfies GridColDef,

              ...self.columns.map(
                f =>
                  ({
                    field: f.name,
                    // cap the auto-fit width: a single multi-kb cell (e.g. a
                    // VCF REF/ALT carrying a long indel sequence) would
                    // otherwise stretch the column to measureGridWidth's 1000px
                    // default and shove every later column off-screen. The full
                    // value stays available via the cell tooltip / feature
                    // details; the user can still drag-resize wider.
                    width: measureGridWidth(
                      [...rows.map(r => r[f.name]), f.name],
                      { minWidth: 20, maxWidth: 200 },
                    ),
                    // infer the column type from the first populated cell, not
                    // rows[0]: a leading empty/string cell would otherwise drop
                    // numeric sorting for the whole column
                    type:
                      typeof rows.find(r => r[f.name] != null)?.[f.name] ===
                      'number'
                        ? 'number'
                        : undefined,
                  }) satisfies GridColDef,
              ),
            ]
          : undefined
      },
    }))
    .views(self => ({
      get visibleRows() {
        const { visibleRowFlags } = self
        return visibleRowFlags
          ? self.rows?.filter(row => visibleRowFlags[row.id] !== false)
          : self.rows
      },
      /**
       * #getter
       * the SVTYPE column field name, present only for structural-variant VCFs
       * (drives whether the SV-type quick-filter dropdown is shown)
       */
      get svTypeColumnField() {
        return self.columns.find(c => c.name === 'INFO.SVTYPE')?.name
      },
      /**
       * #getter
       * the distinct SVTYPE values present in the data, sorted, for the
       * quick-filter dropdown options
       */
      get svTypeOptions() {
        const field = this.svTypeColumnField
        return field
          ? [
              ...new Set(
                self.rows
                  ?.map(r => r[field])
                  .filter(
                    (v): v is string => typeof v === 'string' && v !== '',
                  ),
              ),
            ].sort((a, b) => a.localeCompare(b))
          : []
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
      setSvTypeFilter(arg?: string) {
        self.svTypeFilter = arg
      },
      /**
       * #action
       */
      setVisibleColumns(arg: Record<string, boolean>) {
        self.visibleColumns = arg
      },
    }))
    .preProcessSnapshot(
      (
        snap:
          | ({
              columns?: { isDerived?: boolean }[]
              rowSet?: {
                rows?: {
                  feature?: SimpleFeatureSerialized
                  extendedData?: { vcfFeature?: SimpleFeatureSerialized }
                }[]
              }
            } & Record<string, unknown>)
          | undefined,
      ) =>
        snap
          ? {
              ...snap,
              columns: snap.columns?.filter(f => !f.isDerived),
              rowSet: snap.rowSet
                ? {
                    ...snap.rowSet,
                    rows: snap.rowSet.rows?.map(r => ({
                      ...r,
                      feature: r.feature ?? r.extendedData?.vcfFeature,
                    })),
                  }
                : undefined,
            }
          : snap,
    )
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>
export type SpreadsheetSnapshot = SnapshotIn<SpreadsheetStateModel>

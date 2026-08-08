import {
  assembleLocString,
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
}

export interface RowSet {
  rows: Row[]
}

export interface GridRow {
  id: number
  feature?: SimpleFeatureSerialized
  [key: string]: unknown
}

// shapes written by older versions: cells were positional (aligned with
// columns) and VCF features hid under extendedData
interface LegacyRow extends Row {
  cells?: { text: unknown }[]
  extendedData?: { vcfFeature?: SimpleFeatureSerialized }
}

function migrateRow(row: LegacyRow, columns: { name: string }[]): Row {
  const { feature, cellData, cells, extendedData } = row
  return {
    feature: feature ?? extendedData?.vcfFeature,
    cellData:
      cellData ??
      (cells &&
        Object.fromEntries(columns.map((c, i) => [c.name, cells[i]?.text]))),
  }
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
      columns: types.optional(types.frozen<{ name: string }[]>(), () => []),
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
      /**
       * #property
       * the search box's text (undefined = show all), applied as the grid's
       * quick filter across every visible column. Persisted so the search
       * survives a session reload, and so a session spec can open the sheet
       * already narrowed — the SV inspector's circular view mirrors the rows
       * the search leaves, which is the only way a link can carry a chord
       * subset
       */
      filterText: types.maybe(types.string),
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
        // id/feature last so a same-named data column can't shadow them
        return self.rowSet?.rows.map((row, i) => ({
          ...row.cellData,
          id: i,
          feature: row.feature,
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
                      row.feature ? assembleLocString(row.feature) : 'N/A',
                    ),
                  ) + 40,
                // renderCell alone leaves the column empty in the toolbar's CSV
                // export and unsortable, so give the grid the plain locstring
                // too (the same string the cell renders)
                valueGetter: (
                  _val: unknown,
                  row: { feature?: SimpleFeatureSerialized },
                ) => (row.feature ? assembleLocString(row.feature) : undefined),
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
        // the grid reports an empty lookup when nothing is filtered (its own
        // selectors read it that way), so normalize that back to undefined:
        // otherwise mounting the grid reads as a filter change and rebuilds the
        // SV inspector's chord track for no reason
        self.visibleRowFlags = arg && Object.keys(arg).length ? arg : undefined
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
      setFilterText(arg?: string) {
        self.filterText = arg
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
              columns?: { name: string; isDerived?: boolean }[]
              rowSet?: { rows?: LegacyRow[] }
            } & Record<string, unknown>)
          | undefined,
      ) => {
        const columns = snap?.columns?.filter(f => !f.isDerived) ?? []
        return snap
          ? {
              ...snap,
              columns,
              rowSet: snap.rowSet
                ? {
                    ...snap.rowSet,
                    rows: snap.rowSet.rows?.map(r => migrateRow(r, columns)),
                  }
                : undefined,
            }
          : snap
      },
    )
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>
export type SpreadsheetSnapshot = SnapshotIn<SpreadsheetStateModel>

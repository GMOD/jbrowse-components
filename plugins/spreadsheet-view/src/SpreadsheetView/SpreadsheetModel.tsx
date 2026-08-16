import {
  assembleLocString,
  getSession,
  measureGridWidth,
  toLocale,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import LocationCell from './components/LocationCell.tsx'
import { svSize } from './svSize.ts'

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

type VisibleRowFlags = Record<number, boolean>

/**
 * Rows to measure column widths against. Evenly spaced across the whole sheet
 * rather than the first N, so a column that only widens near the end of the
 * file is still seen — a VCF sorted by contig puts its longest REF/ALT
 * sequences wherever they happen to fall, not at the top.
 */
const WIDTH_SAMPLE_ROWS = 1000

function sampleRows<T>(rows: T[] | undefined) {
  if (!rows || rows.length <= WIDTH_SAMPLE_ROWS) {
    return rows ?? []
  }
  const stride = Math.ceil(rows.length / WIDTH_SAMPLE_ROWS)
  const out: T[] = []
  for (let i = 0; i < rows.length; i += stride) {
    out.push(rows[i]!)
  }
  return out
}

/**
 * Whether two visible-row lookups describe the same set of rows.
 *
 * The grid hands back a freshly built lookup on every pass of its filter
 * pipeline, and several of those passes cannot have changed the result: it
 * re-applies filters on `rowsSet`, on a strategy-processor change, and on a
 * column-visibility change while a quick filter is active. A new object each
 * time is a new `visibleRows`, which for the SV inspector means a new chord
 * track configuration — and that track carries every visible feature inline, so
 * rebuilding it deep-clones and re-validates the whole callset. Comparing the
 * lookups is one linear scan, which is far less than that.
 */
export function sameVisibleRowFlags(a?: VisibleRowFlags, b?: VisibleRowFlags) {
  if (a === b) {
    return true
  }
  if (!a || !b) {
    return false
  }
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length && keys.every(k => a[+k] === b[+k])
  )
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
      visibleRowFlags: undefined as VisibleRowFlags | undefined,
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
      /**
       * #getter
       * the SVTYPE column field name, present only for structural-variant VCFs.
       * Doubles as the sheet's "this is an SV callset" signal: it drives the
       * SV-type quick-filter dropdown, and it decides whether the derived size
       * column reports SV size or a plain interval length
       */
      get svTypeColumnField() {
        return self.columns.find(c => c.name === 'INFO.SVTYPE')?.name
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get dataGridColumns() {
        const { rows } = self
        const isSvSheet = !!self.svTypeColumnField
        // a non-SV sheet keeps reporting the plain interval length, so BED,
        // BEDPE and STAR-Fusion read exactly as before
        const rowSize = ({ feature }: { feature?: SimpleFeatureSerialized }) =>
          feature
            ? isSvSheet
              ? svSize(feature)
              : feature.end - feature.start
            : undefined
        // widths come off a sample, not the sheet. measureGridWidth walks every
        // character of every value it is handed, so measuring all of them is
        // rows × columns × characters of blocking main thread — 3.6s for a
        // 50k-row, 25-column sheet, spent the moment the import finishes and
        // again on every session reload. The width is a heuristic for auto-fit
        // and the columns below cap it anyway, so a sample buys the same answer
        // for a fortieth of the cost
        const sample = sampleRows(rows)
        return rows
          ? [
              {
                field: 'Location',
                width:
                  measureGridWidth(
                    sample.map(row =>
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
                // the field stays `Length` across both spellings so one saved
                // column-visibility preference covers them, and only the header
                // changes: for an SV callset the number is the SV's size, which
                // is a different quantity from the record's footprint on the
                // reference and is what a reader of that sheet wants. See
                // `svSize`
                field: 'Length',
                headerName: isSvSheet ? 'SV size' : 'Length',
                type: 'number',
                // measured through the same formatter the cell renders with:
                // measuring the bare number left the column a separator short
                // per three digits, so a megabase-scale SV read as `1,234,5…`
                width: measureGridWidth(
                  sample.map(row => {
                    const size = rowSize(row)
                    return size === undefined ? '' : toLocale(size)
                  }),
                ),
                valueGetter: (
                  _val: unknown,
                  row: { feature?: SimpleFeatureSerialized },
                ) => rowSize(row),
                // blank, not the string "undefined", for a row with no size to
                // report — an interchromosomal breakend has none, and there are
                // 26 of them in the 210-call C-GIAB benchmark alone
                valueFormatter: (arg?: number) =>
                  arg === undefined ? '' : toLocale(arg),
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
                      [...sample.map(r => r[f.name]), f.name],
                      { minWidth: 20, maxWidth: 200 },
                    ),
                    // infer the column type from the first populated cell, not
                    // rows[0]: a leading empty/string cell would otherwise drop
                    // numeric sorting for the whole column. Off the full rows,
                    // not the sample: find stops at the first hit, so it costs
                    // nothing on a populated column and only walks the sheet for
                    // one that is empty — where sampling could pick the wrong
                    // type outright rather than a slightly narrow column
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
       * the distinct SVTYPE values present in the data, sorted, for the
       * quick-filter dropdown options
       */
      get svTypeOptions() {
        const field = self.svTypeColumnField
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
      setVisibleRows(arg?: VisibleRowFlags) {
        // the grid reports an empty lookup when nothing is filtered (its own
        // selectors read it that way), so normalize that back to undefined:
        // otherwise mounting the grid reads as a filter change and rebuilds the
        // SV inspector's chord track for no reason
        const next = arg && Object.keys(arg).length ? arg : undefined
        // and a re-filter that lands on the same rows is the same non-change,
        // just spelled as a fresh object rather than an empty one
        if (!sameVisibleRowFlags(self.visibleRowFlags, next)) {
          self.visibleRowFlags = next
        }
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
        if (!snap) {
          return snap
        }
        const columns = snap.columns?.filter(f => !f.isDerived) ?? []
        const rows = snap.rowSet?.rows
        // Rebuild the rows only when some row is actually in an older shape.
        // migrateRow allocates a fresh object per row, and this hook runs on
        // every snapshot applied to the node — including the freshly parsed one
        // displaySpreadsheet casts on every import, which has nothing to
        // migrate and can be six figures of rows. The scan that replaces it is
        // two property checks per row and stops at the first legacy one
        const legacy = rows?.some(r => !!r.cells || !!r.extendedData)
        return {
          ...snap,
          columns,
          rowSet:
            legacy && rows
              ? { ...snap.rowSet, rows: rows.map(r => migrateRow(r, columns)) }
              : snap.rowSet,
        }
      },
    )
}

export type SpreadsheetStateModel = ReturnType<typeof stateModelFactory>
export type SpreadsheetModel = Instance<SpreadsheetStateModel>
export type SpreadsheetSnapshot = SnapshotIn<SpreadsheetStateModel>

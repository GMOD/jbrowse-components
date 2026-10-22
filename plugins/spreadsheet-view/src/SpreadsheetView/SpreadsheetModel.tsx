import {
  SimpleFeature,
  assembleLocString,
  getSession,
  isFeature,
  measureGridWidth,
  toLocale,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  distinctJunctions,
  junctionFromFeature,
  svMateLocus,
} from '@jbrowse/sv-core'

import LocationCell from './components/LocationCell.tsx'
import MateCell from './components/MateCell.tsx'
import { svSize } from './svSize.ts'
import { rowSvType, tallySvTypes } from './svTypeTally.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { Junction, SvEvent } from '@jbrowse/sv-core'
import type { GridColDef } from '@mui/x-data-grid'

export interface Row {
  feature?: SimpleFeatureSerialized
  cellData?: Record<string, unknown>
}

export interface RowSet {
  rows: Row[]
}

/** what the sheet reads off a row's record, worked out once per load */
export interface RowDerived {
  svType?: string
  location?: string
  size?: number
  mate?: { raw: string; display: string }
}

export interface GridRow {
  id: number
  feature?: SimpleFeatureSerialized
  derived: RowDerived
  [key: string]: unknown
}

// a non-SV sheet reports the plain interval length and no mate column
function deriveRow(
  feature: SimpleFeatureSerialized | undefined,
  svTypeToken: unknown,
  isSvSheet: boolean,
): RowDerived {
  const svType = rowSvType(feature, svTypeToken)
  if (!feature) {
    return { svType }
  }
  const location = assembleLocString(feature)
  if (!isSvSheet) {
    return { svType, location, size: feature.end - feature.start }
  }
  const mate = svMateLocus(new SimpleFeature(feature))
  return {
    svType,
    location,
    size: svSize(feature, mate),
    mate: mate && {
      raw: `${mate.refName}:${mate.pos + 1}`,
      display: assembleLocString({
        refName: mate.refName,
        start: mate.pos,
        end: mate.pos + 1,
      }),
    },
  }
}

// shapes written by older versions: cells were positional (aligned with
// columns) and VCF features hid under extendedData
interface LegacyRow extends Row {
  cells?: { text: unknown }[]
  extendedData?: { vcfFeature?: SimpleFeatureSerialized }
}

type VisibleRowFlags = Record<number, boolean>

/** VCF 4.4's key for the rearrangement event a record belongs to */
const SV_EVENT_COLUMN = 'INFO.EVENT'

// spread over the whole sheet, since the widest REF/ALT can fall anywhere
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

// The grid rebuilds its visible-rows lookup on filter passes that change
// nothing, and every new object recomputes what the SV inspector derives from
// `visibleRows`.
function sameVisibleRowFlags(a?: VisibleRowFlags, b?: VisibleRowFlags) {
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

function naturalOrder(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true })
}

function eventLabel(row: GridRow, field?: string) {
  const value = field ? row[field] : undefined
  return typeof value === 'string' || typeof value === 'number'
    ? `${value}`
    : undefined
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
       * the SV class the sheet is narrowed to, such as `BND` (undefined = show
       * all); a class rather than a raw `INFO.SVTYPE` token
       */
      svTypeFilter: types.maybe(types.string),
      /**
       * #property
       * the caller's event the sheet is narrowed to (undefined = show all), a
       * value of the `svEventColumnField` column matched whole
       */
      svEventFilter: types.maybe(types.string),
      /**
       * #property
       * the search box's text (undefined = show all), applied as the grid's
       * quick filter; the SV inspector's circle draws the rows it leaves
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
        const field = this.svTypeColumnField
        return self.rowSet?.rows.map(({ cellData, feature }, i) => {
          const derived = deriveRow(
            feature,
            field ? cellData?.[field] : undefined,
            !!field,
          )
          // last, so a same-named data column can't shadow them
          return {
            ...cellData,
            id: i,
            feature:
              feature && derived.svType && feature.svType === undefined
                ? { ...feature, svType: derived.svType }
                : feature,
            derived,
          }
        })
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
       * the SVTYPE column, present only in a structural-variant VCF, which
       * makes this the sheet's "SV callset" signal
       */
      get svTypeColumnField() {
        return self.columns.find(c => c.name === 'INFO.SVTYPE')?.name
      },
      /**
       * #getter
       * the column grouping records into rearrangement events, where the file
       * has one
       */
      get svEventColumnField() {
        return self.columns.find(c => c.name === SV_EVENT_COLUMN)?.name
      },
      /**
       * #getter
       * each row's junction, canonical refNames and all; undefined for a row
       * naming no other end, and for every row until the assembly loads
       */
      get rowJunctions() {
        const { assemblyName } = self
        const assembly = assemblyName
          ? getSession(self).assemblyManager.get(assemblyName)
          : undefined
        return (this.rows ?? []).map(r =>
          assembly?.initialized && r.feature
            ? junctionFromFeature(new SimpleFeature(r.feature), assembly)
            : undefined,
        )
      },
      /**
       * #getter
       * every junction in the sheet, filters ignored, for walking a
       * rearrangement from one record to the rest
       */
      get svJunctions() {
        return this.rowJunctions.filter(j => j !== undefined)
      },
      /**
       * #getter
       * every value of `svEventColumnField` whose rows hold more than one
       * junction: GRIDSS also gives `EVENT` to a breakpoint's two mates
       */
      get svEvents() {
        const field = this.svEventColumnField
        const { rowJunctions } = this
        const events = new Map<
          string,
          SvEvent & { count: number; featureIds: string[] }
        >()
        for (const row of field ? (this.rows ?? []) : []) {
          const label = eventLabel(row, field)
          if (label !== undefined) {
            const event = events.get(label) ?? {
              label,
              junctions: [],
              featureIds: [],
              count: 0,
            }
            events.set(label, event)
            event.count++
            if (row.feature) {
              event.featureIds.push(row.feature.uniqueId)
            }
            const junction = rowJunctions[row.id]
            if (junction) {
              event.junctions.push(junction)
            }
          }
        }
        return [...events.values()]
          .filter(e => distinctJunctions(e.junctions).length > 1)
          .map(e => ({
            ...e,
            refNames: [
              ...new Set(e.junctions.flatMap(j => [j.refName, j.mateRefName])),
            ].sort(naturalOrder),
          }))
          .sort((a, b) => naturalOrder(a.label, b.label))
      },
      /**
       * #method
       * the event a record belongs to, for a drill-down that opens every locus
       * of it
       */
      svEventFor(feature: { uniqueId: string }) {
        return this.svEvents.find(e => e.featureIds.includes(feature.uniqueId))
      },
      /**
       * #method
       * The sheet's `FindJunctionsNear`, which lets the breakpoint split view
       * follow a chain from a row or a chord.
       *
       * A junction matches by either end, which an index keyed on one
       * coordinate per record cannot offer, so the walk goes both ways from
       * any record of an event. One walk takes `svJunctions` once, since it
       * reads from async code that nothing observes.
       */
      findJunctionsNear(): (region: {
        refName: string
        start: number
        end: number
      }) => Promise<
        { refName: string; pos: number; mateRefName: string; matePos: number }[]
      > {
        let junctions: Junction[] | undefined
        return region => {
          const inWindow = (refName: string, pos: number) =>
            refName === region.refName &&
            pos >= region.start &&
            pos < region.end
          junctions ??= this.svJunctions
          return Promise.resolve(
            junctions.filter(
              j =>
                inWindow(j.refName, j.pos) ||
                inWindow(j.mateRefName, j.matePos),
            ),
          )
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get dataGridColumns(): GridColDef<GridRow>[] | undefined {
        const { rows } = self
        if (!rows) {
          return undefined
        }
        const isSvSheet = !!self.svTypeColumnField
        // measureGridWidth walks every character it is handed, so widths come
        // off a sample: the whole of a 50k-row sheet blocked for 3.6s
        const sampled = sampleRows(rows)
        const sample = sampled.map(r => r.derived)
        return [
          {
            field: 'Location',
            width: measureGridWidth(sample.map(d => d.location ?? 'N/A')) + 40,
            // the plain string too, or sorting and the CSV export see nothing
            valueGetter: (_val, row) => row.derived.location,
            renderCell: ({ row }) =>
              row.feature ? (
                <LocationCell model={self} feature={row.feature} />
              ) : (
                'N/A'
              ),
          },
          {
            // one field for both headers, so one saved visibility covers them
            field: 'Length',
            headerName: isSvSheet ? 'SV size' : 'Length',
            type: 'number',
            width: measureGridWidth(
              sample.map(d => (d.size === undefined ? '' : toLocale(d.size))),
            ),
            valueGetter: (_val, row) => row.derived.size,
            // an interchromosomal breakend has no size
            valueFormatter: (arg?: number) =>
              arg === undefined ? '' : toLocale(arg),
          },
          // without this column the mate's chromosome is only in ALT, where
          // the quick filter cannot single it out
          ...(isSvSheet
            ? [
                {
                  field: 'Mate',
                  width: measureGridWidth(
                    sample.map(d => d.mate?.display ?? ''),
                  ),
                  valueGetter: (_val, row) => row.derived.mate?.display,
                  renderCell: ({ row }) =>
                    row.derived.mate ? (
                      <MateCell
                        model={self}
                        locString={row.derived.mate.raw}
                        display={row.derived.mate.display}
                      />
                    ) : null,
                } satisfies GridColDef<GridRow>,
              ]
            : []),
          ...self.columns.map(
            f =>
              ({
                field: f.name,
                // capped, so one multi-kb REF/ALT cannot push every later
                // column off screen
                width: measureGridWidth(
                  [...sampled.map(r => r[f.name]), f.name],
                  { minWidth: 20, maxWidth: 200 },
                ),
                // typed by the first populated cell, off every row: a sample
                // could miss the only values of a sparse column
                type:
                  typeof rows.find(r => r[f.name] != null)?.[f.name] ===
                  'number'
                    ? 'number'
                    : undefined,
              }) satisfies GridColDef<GridRow>,
          ),
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the rows the grid is handed, narrowed by the dropdowns here because
       * the community grid's filter model holds only the reader's own filter
       */
      get gridRows() {
        const { svTypeFilter, svEventFilter } = self
        const { svEventColumnField } = self
        return self.rows?.filter(
          row =>
            (svTypeFilter === undefined ||
              row.derived.svType === svTypeFilter) &&
            (svEventFilter === undefined ||
              eventLabel(row, svEventColumnField) === svEventFilter),
        )
      },
      get visibleRows() {
        const { visibleRowFlags } = self
        return visibleRowFlags
          ? this.gridRows?.filter(row => visibleRowFlags[row.id] !== false)
          : this.gridRows
      },
      /**
       * #getter
       * the SV classes in the whole sheet, which the dropdown offers
       */
      get svTypeOptions() {
        return tallySvTypes(self.rows)
      },
      /**
       * #getter
       * the SV classes among the rows on screen, which the SV inspector's
       * legend counts
       */
      get visibleSvTypes() {
        return tallySvTypes(this.visibleRows)
      },
      /**
       * #getter
       * the dropdowns above the grid, as data; `key` is what `setGridFacet`
       * takes and the sheet persists
       */
      get gridFacets() {
        return [
          ...(self.svTypeColumnField && this.svTypeOptions.length
            ? [
                {
                  id: 'sv-type-filter' as const,
                  label: 'Filter by SV type',
                  selected: self.svTypeFilter,
                  options: this.svTypeOptions.map(o => ({
                    key: o.type,
                    label: `${o.label} (${o.count})`,
                  })),
                },
              ]
            : []),
          ...(self.svEvents.length
            ? [
                {
                  id: 'sv-event-filter' as const,
                  label: 'Filter by event',
                  selected: self.svEventFilter,
                  options: self.svEvents.map(e => ({
                    key: e.label,
                    label: `${e.label} (${e.count} records; ${e.refNames.join(', ')})`,
                  })),
                },
              ]
            : []),
        ]
      },
      /**
       * #getter
       * the row holding the session's selected feature, so a chord click in
       * the SV inspector lands on its row
       */
      get selectedRowId() {
        const { selection } = getSession(self)
        const id = isFeature(selection) ? selection.id() : undefined
        return id === undefined
          ? undefined
          : self.rows?.find(r => r.feature?.uniqueId === id)?.id
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setVisibleRows(arg?: VisibleRowFlags) {
        // the grid reports an empty lookup when nothing is filtered
        const next = arg && Object.keys(arg).length ? arg : undefined
        if (!sameVisibleRowFlags(self.visibleRowFlags, next)) {
          self.visibleRowFlags = next
        }
      },
      /**
       * #action
       * put a row's record on the session selection, which highlights its
       * chord in the SV inspector
       */
      setSelectedFeature(feature?: SimpleFeatureSerialized) {
        const session = getSession(self)
        if (feature) {
          session.setSelection(new SimpleFeature(feature))
        } else {
          session.clearSelection()
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
      setSvEventFilter(arg?: string) {
        self.svEventFilter = arg
      },
      /**
       * #action
       * select an option of one of `gridFacets` by its `key`
       */
      setGridFacet(id: 'sv-type-filter' | 'sv-event-filter', key?: string) {
        if (id === 'sv-type-filter') {
          self.svTypeFilter = key
        } else {
          self.svEventFilter = key
        }
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
        // every import passes through here, so copy rows only when one is
        // in an older shape
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

import {
  SimpleFeature,
  assembleLocString,
  getSession,
  measureGridWidth,
  selectedFeatureIdFor,
  toLocale,
} from '@jbrowse/core/util'
import {
  cellText,
  compareValues,
  csvLine,
  naturalOrder,
  splitSearchWords,
} from '@jbrowse/core/util/tableText'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import {
  distinctJunctions,
  junctionFromFeature,
  svMateLocus,
} from '@jbrowse/sv-core'

import { svSize } from './svSize.ts'
import { rowSvType, tallySvTypes } from './svTypeTally.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { Junction, SvEvent } from '@jbrowse/sv-core'

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

/**
 * A column of the sheet. `value` is what sorting, the search and the CSV
 * export read; the table draws a `location` or `mate` column as a link and a
 * `number` column with thousands separators.
 */
export interface SheetColumn {
  field: string
  header: string
  width: number
  kind: 'location' | 'mate' | 'number' | 'text'
  value: (row: GridRow) => unknown
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
       * the SV classes the sheet is narrowed to, such as `BND` (empty = show
       * all); classes rather than raw `INFO.SVTYPE` tokens
       */
      svTypeFilter: types.stripDefault(types.array(types.string), []),
      /**
       * #property
       * the caller's event the sheet is narrowed to (undefined = show all), a
       * value of the `svEventColumnField` column matched whole
       */
      svEventFilter: types.maybe(types.string),
      /**
       * #property
       * the search box's text (undefined = show all): a row is kept when each
       * of its words, in any case, is in one of its shown columns; the SV
       * inspector's circle draws the rows it leaves
       */
      filterText: types.maybe(types.string),
      /**
       * #property
       * the field of the column the rows are sorted by (undefined = file
       * order)
       */
      sortField: types.maybe(types.string),
      /**
       * #property
       */
      sortAscending: types.stripDefault(types.boolean, true),
    })
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
      get sheetColumns(): SheetColumn[] {
        const rows = self.rows ?? []
        const isSvSheet = !!self.svTypeColumnField
        // measureGridWidth walks every character it is handed, so widths come
        // off a sample: the whole of a 50k-row sheet blocked for 3.6s
        const sampled = sampleRows(rows)
        const sample = sampled.map(r => r.derived)
        return [
          {
            field: 'Location',
            header: 'Location',
            kind: 'location' as const,
            width: measureGridWidth(sample.map(d => d.location ?? 'N/A')) + 40,
            value: (row: GridRow) => row.derived.location,
          },
          {
            // one field for both headers, so one saved visibility covers them
            field: 'Length',
            header: isSvSheet ? 'SV size' : 'Length',
            kind: 'number' as const,
            width: measureGridWidth(
              sample.map(d => (d.size === undefined ? '' : toLocale(d.size))),
            ),
            // undefined for an interchromosomal breakend, which has no size
            value: (row: GridRow) => row.derived.size,
          },
          // without this column the mate's chromosome is only in ALT, where
          // the search cannot single it out
          ...(isSvSheet
            ? [
                {
                  field: 'Mate',
                  header: 'Mate',
                  kind: 'mate' as const,
                  width: measureGridWidth(
                    sample.map(d => d.mate?.display ?? ''),
                  ),
                  value: (row: GridRow) => row.derived.mate?.display,
                },
              ]
            : []),
          ...self.columns.map(f => ({
            field: f.name,
            header: f.name,
            // typed by the first populated cell, off every row: a sample
            // could miss the only values of a sparse column
            kind:
              typeof rows.find(r => r[f.name] != null)?.[f.name] === 'number'
                ? ('number' as const)
                : ('text' as const),
            // capped, so one multi-kb REF/ALT cannot push every later column
            // off screen
            width: measureGridWidth([...sampled.map(r => r[f.name]), f.name], {
              minWidth: 20,
              maxWidth: 200,
            }),
            value: (row: GridRow) => row[f.name],
          })),
        ]
      },
      /**
       * #getter
       * the columns `visibleColumns` leaves shown
       */
      get shownColumns() {
        return this.sheetColumns.filter(
          c => self.visibleColumns[c.field] !== false,
        )
      },
      /**
       * #getter
       * the words of `filterText`, lowercased
       */
      get searchWords() {
        return splitSearchWords(self.filterText ?? '')
      },
      /**
       * #getter
       * each row's shown cells as one lowercased string, by row id, which the
       * search reads on every keystroke
       */
      get searchTexts() {
        const columns = this.shownColumns
        return (self.rows ?? []).map(row =>
          columns
            .map(c => cellText(c.value(row)))
            .join('\u0000')
            .toLowerCase(),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the rows the dropdowns leave
       */
      get gridRows() {
        const { svEventFilter } = self
        const svTypeFilter = this.effectiveSvTypeFilter
        const { svEventColumnField } = self
        return self.rows?.filter(
          row =>
            (svTypeFilter.length === 0 ||
              (row.derived.svType !== undefined &&
                svTypeFilter.includes(row.derived.svType))) &&
            (svEventFilter === undefined ||
              eventLabel(row, svEventColumnField) === svEventFilter),
        )
      },
      /**
       * #getter
       * the rows the dropdowns and the search leave, in file order
       */
      get visibleRows() {
        const { searchWords } = self
        let rows = this.gridRows
        if (searchWords.length) {
          const { searchTexts } = self
          rows = rows?.filter(row => {
            const text = searchTexts[row.id]!
            return searchWords.every(word => text.includes(word))
          })
        }
        return rows
      },
      /**
       * #getter
       * the shown column the rows sort by, if any
       */
      get sortColumn() {
        const { sortField } = self
        return sortField === undefined
          ? undefined
          : self.shownColumns.find(c => c.field === sortField)
      },
      /**
       * #getter
       * `visibleRows` in the order the table draws them
       */
      get sortedRows() {
        const rows = this.visibleRows ?? []
        const column = this.sortColumn
        const direction = self.sortAscending ? 1 : -1
        return column
          ? rows
              .map(row => ({ row, key: column.value(row) }))
              .sort((a, b) => compareValues(a.key, b.key, direction))
              .map(({ row }) => row)
          : rows
      },
      /**
       * #getter
       * the classes of `svTypeFilter` this sheet holds, since a reloaded file
       * can drop one; none narrows nothing
       */
      get effectiveSvTypeFilter() {
        const present = new Set(this.svTypeOptions.map(o => o.type))
        return self.svTypeFilter.filter(svType => present.has(svType))
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
       * the dropdowns above the grid, as data; a `key` is what `setGridFacet`
       * takes and the sheet persists, and none selected shows all
       */
      get gridFacets() {
        return [
          ...(self.svTypeColumnField && this.svTypeOptions.length
            ? [
                {
                  id: 'sv-type-filter' as const,
                  label: 'Filter by SV type',
                  multiple: true,
                  selected: this.effectiveSvTypeFilter,
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
                  multiple: false,
                  selected:
                    self.svEventFilter === undefined
                      ? []
                      : [self.svEventFilter],
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
       */
      get rowsTrackId() {
        return getParent<{ rowsTrackId: string }>(self).rowsTrackId
      },
      /**
       * #getter
       * the row holding the session's selected feature, so a chord click in
       * the SV inspector lands on its row
       */
      get selectedRowId() {
        const id = selectedFeatureIdFor(getSession(self), this.rowsTrackId)
        return id === undefined
          ? undefined
          : self.rows?.find(r => r.feature?.uniqueId === id)?.id
      },
      /**
       * #getter
       * where `selectedRowId` sits in `sortedRows`, which the table scrolls
       * into view; undefined when the filters leave it out
       */
      get selectedRowIndex() {
        const id = this.selectedRowId
        const index =
          id === undefined ? -1 : this.sortedRows.findIndex(r => r.id === id)
        return index === -1 ? undefined : index
      },
      /**
       * #method
       * `sortedRows` under the shown columns' headers as CSV, each value
       * plain, as the search reads it
       */
      csvText() {
        const columns = self.shownColumns
        return [
          csvLine(columns.map(c => c.header)),
          ...this.sortedRows.map(row =>
            csvLine(columns.map(c => cellText(c.value(row)))),
          ),
        ].join('\r\n')
      },
    }))
    .actions(self => {
      // every class selected is no filter
      const writeSvTypeFilter = (svTypes: string[]) => {
        const options = self.svTypeOptions
        self.svTypeFilter.replace(
          options.length > 0 && options.every(o => svTypes.includes(o.type))
            ? []
            : svTypes,
        )
      }
      return {
        /**
         * #action
         * put a row's record on the session selection, which highlights its
         * chord in the SV inspector
         */
        setSelectedFeature(feature?: SimpleFeatureSerialized) {
          const session = getSession(self)
          if (feature) {
            session.setSelection(new SimpleFeature(feature), self.rowsTrackId)
          } else {
            session.clearSelection()
          }
        },
        /**
         * #action
         */
        setSvTypeFilter(svTypes: string[]) {
          writeSvTypeFilter(svTypes)
        },
        /**
         * #action
         * add an SV class to the filter, or take it out; with none left, or
         * all of them in, every class shows
         */
        toggleSvType(svType: string) {
          const current = self.effectiveSvTypeFilter
          writeSvTypeFilter(
            current.includes(svType)
              ? current.filter(t => t !== svType)
              : [...current, svType],
          )
        },
        /**
         * #action
         */
        setSvEventFilter(arg?: string) {
          self.svEventFilter = arg
        },
        /**
         * #action
         * select options of one of `gridFacets` by their `key`; a facet that
         * is not `multiple` takes the first
         */
        setGridFacet(id: 'sv-type-filter' | 'sv-event-filter', keys: string[]) {
          if (id === 'sv-type-filter') {
            writeSvTypeFilter(keys)
          } else {
            self.svEventFilter = keys[0]
          }
        },
        /**
         * #action
         */
        setFilterText(arg?: string) {
          self.filterText = arg || undefined
        },
        /**
         * #action
         * sort by the column with this field; an empty field is file order
         */
        setSort(field: string, ascending: boolean) {
          self.sortField = field || undefined
          self.sortAscending = ascending
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
        setColumnVisible(field: string, visible: boolean) {
          const rest = Object.fromEntries(
            Object.entries(self.visibleColumns).filter(
              ([key]) => key !== field,
            ),
          )
          self.visibleColumns = visible ? rest : { ...rest, [field]: false }
        },
      }
    })
    .preProcessSnapshot(
      (
        snap:
          | ({
              columns?: { name: string; isDerived?: boolean }[]
              svTypeFilter?: string | string[]
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
          svTypeFilter:
            typeof snap.svTypeFilter === 'string'
              ? [snap.svTypeFilter]
              : snap.svTypeFilter,
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

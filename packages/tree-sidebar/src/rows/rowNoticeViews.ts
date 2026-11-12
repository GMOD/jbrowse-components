import {
  predicatesOf,
  unreadFieldNotice,
} from '@jbrowse/core/util/fieldPredicate'
import { compareStructural } from 'mobx'

import { rowAnnotationNotices } from '../color/rowAnnotationNotices.ts'
import { baseRows, liveRows, present } from './baseRows.ts'
import {
  filteredRows,
  keptRows,
  listedNames,
  rowFilterText,
  unmatchedKeptNames,
  unreadRowFields,
} from './narrowRows.ts'

import type { RowAnnotationDeal } from '../color/rowAnnotations.ts'
import type { Row } from '../types.ts'
import type { RowBanding } from './bandRows.ts'
import type { BaseRowsHost } from './baseRows.ts'
import type { RowNarrowing } from './narrowRows.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/**
 * What {@link rowNoticeViews} reads: the rows at each stage, what narrows and
 * bands them, the annotation columns, and the hooks that say which names a
 * `rows.kept` may miss.
 */
export interface RowNoticeHost<S extends Row> extends BaseRowsHost {
  expandedRows: S[]
  shownRows: S[]
  rowBanding: RowBanding | undefined
  rowBand(row: S): string
  rowNarrowing: RowNarrowing
  rowNarrowingShows: boolean
  rowFocus: readonly string[] | undefined
  rowsListedUpFront: boolean
  rowFoundAtSomeLoci(name: string): boolean
  rowColorFields: readonly string[]
  drawsRowAnnotations: boolean
  rowAnnotationDeals: readonly RowAnnotationDeal[]
  rowColumnLabels: readonly string[]
  height: number
}

/**
 * What the rows say back to the reader: the corner notice's lines on the
 * banding, the narrowing and `rows.annotations`, and the "Showing N of M
 * rows" chip.
 */
export function rowNoticeViews<S extends Row>(self: RowNoticeHost<S>) {
  return {
    /**
     * #getter
     * The `rows.filter` this display's base declares, which "Show all"
     * and "Reset row order" return to.
     */
    get baseRowFilter(): FieldPredicate[] {
      return predicatesOf(baseRows(self).filter)
    },
    /**
     * #method
     * The notice for a top-level `filter` field no loaded `record`
     * carries: where a row carries it, a pointer at `rows.filter`, which
     * keeps rows by their attributes, where the top-level `filter` tests
     * records.
     */
    unreadFilterFieldNotice(field: string, record: string) {
      return self.rowColorFields.includes(field)
        ? `The filter tests "${field}", a row attribute no loaded ${record} carries, so it hides every ${record}: rows.filter keeps rows by their attributes`
        : unreadFieldNotice(field, record)
    },
    /**
     * #getter
     * A line for the corner notice when rows have arrived and none has
     * the field `rowBanding` bands by, which then bands nothing.
     */
    get rowBandingNotices(): string[] {
      const banding = self.rowBanding
      const rows = self.expandedRows
      return banding &&
        rows.length > 0 &&
        rows.every(row => self.rowBand(row) === '')
        ? [`facet.field: no row carries ${banding.field}, so it bands nothing`]
        : []
    },
    /**
     * #getter
     * Whether "Show all" has anything to clear: `rows.kept` names rows, or
     * `rows.filter` differs from the config's.
     */
    get rowNarrowingClears(): boolean {
      return (
        (self.rowFocus?.length ?? 0) > 0 ||
        !compareStructural(
          present(liveRows(self).filter),
          present(baseRows(self).filter),
        )
      )
    },
    /**
     * #getter
     * The corner notice's lines on the narrowing, once the rows are known:
     * a `rows.filter` field no row carries, what left no row where none
     * shows, and where the track lists its rows up front
     * (`rowsListedUpFront`), the `rows.kept` names no row has.
     */
    get rowNarrowingNotices(): string[] {
      const rows = self.expandedRows
      const narrowing = self.rowNarrowing
      const unread = unreadRowFields(rows, narrowing.filter)
      const emptiedBy =
        rows.length > 0 && self.shownRows.length === 0
          ? filteredRows(rows, narrowing.filter).length === 0
            ? 'filter'
            : keptRows(rows, narrowing.kept, narrowing.rowAlias).length > 0
              ? 'hidden'
              : 'kept'
          : undefined
      const filterText = rowFilterText(narrowing.filter)
      const unmatched = self.rowsListedUpFront
        ? unmatchedKeptNames(rows, narrowing).filter(
            name => !self.rowFoundAtSomeLoci(name),
          )
        : []
      return rows.length === 0
        ? []
        : [
            ...unread.map(
              field =>
                `rows.filter tests "${field}", which no row carries, so it filters out every row`,
            ),
            ...(emptiedBy === 'filter' && unread.length === 0
              ? [`Every row is filtered out by rows.filter (${filterText})`]
              : []),
            ...(emptiedBy === 'hidden'
              ? [
                  `Every row rows.kept names is hidden by rows.filter (${filterText})`,
                ]
              : []),
            ...(emptiedBy === 'kept'
              ? [
                  `rows.kept names no row${unmatched.length ? ` (${listedNames(unmatched)})` : ' here'}, so no row shows`,
                ]
              : unmatched.length > 0
                ? [
                    `rows.kept names ${listedNames(unmatched)}, which no row has`,
                  ]
                : []),
          ]
    },
    /**
     * #method
     * The lines for the corner notice about `rows.annotations` on a track
     * `height` px tall (`rowAnnotationNotices`): an entry on a field no row
     * carries, one on mostly distinct numbers, and column labels taking
     * more than half the track.
     */
    rowAnnotationNotices(height: number): string[] {
      return rowAnnotationNotices({
        rows: self.expandedRows,
        settings: self.drawsRowAnnotations
          ? self.rowAnnotationDeals.map(deal => deal.setting)
          : [],
        columnLabels: self.rowColumnLabels,
        height,
      })
    },
    /**
     * #getter
     * The corner notice's lines on the rows, which each display spreads
     * into its `notices`: `rowBandingNotices`, `rowNarrowingNotices`, then
     * `rowAnnotationNotices` at the track's `height`.
     */
    get rowNotices(): string[] {
      return [
        ...this.rowBandingNotices,
        ...this.rowNarrowingNotices,
        ...this.rowAnnotationNotices(self.height),
      ]
    },
    /**
     * #getter
     * The chip above the rows while `rowNarrowingShows`: "Showing N of M
     * rows", with "Show all" where `rowNarrowingClears`, and the config's
     * own `rows.filter`, which "Show all" keeps, stated in its tooltip.
     */
    get rowNarrowingHint(): { text: string; title: string } | undefined {
      const base = rowFilterText(this.baseRowFilter)
      const clears = this.rowNarrowingClears
      return self.rowNarrowingShows
        ? {
            text: `Showing ${self.shownRows.length} of ${self.expandedRows.length} rows${clears ? ' · Show all' : ''}`,
            title: [
              ...(clears ? ['Click to show every row again'] : []),
              ...(base ? [`The track's config keeps rows where ${base}`] : []),
            ].join('. '),
          }
        : undefined
    },
  }
}

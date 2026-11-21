import { sum } from '@jbrowse/core/util'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import {
  fitLaneRows,
  groupRowCaps,
  maxRowsFor,
  resolveFitDefaultCap,
} from './groupLayout.ts'
import { laneBandOverheads } from './sectionLayout.ts'

import type { RowCap } from '../RenderAlignmentDataRPC/types.ts'
import type { AlignmentsUnit } from './constants.ts'
import type { GroupLayoutContext, GroupSize } from './groupLayout.ts'
import type { LaneBandsInput } from './sectionLayout.ts'
import type { IComputedValue } from 'mobx'

const NO_GROUP_SIZES: ReadonlyMap<string, GroupSize> = new Map()

/** What {@link fitViews} reads. */
export interface FitHost {
  unit: AlignmentsUnit
  showPileup: boolean
  collapseSections: boolean
  fitHeightToDisplay: boolean
  groupOrder: readonly { key: string }[]
  collapsedGroups: ReadonlySet<string>
  groupSizes: ReadonlyMap<string, GroupSize>
  laneBandsInput: LaneBandsInput
  arcsResult: { inkGroupKeys: ReadonlySet<string> }
  junctionsStripLanes: ReadonlySet<string>
  pileupMaxLayoutHeight: number
  rowHeight: number
  groupLayoutContext: GroupLayoutContext
  isFitting: boolean
  autoHeight: boolean
  growMaxHeight: number
  fitTargetHeight: number
}

/**
 * The row caps a lane lays out to, the shared fit budget, and whether a sort
 * or a per-lane size can take effect.
 */
export function fitViews(self: FitHost) {
  let rowCaps: IComputedValue<ReadonlyMap<string, RowCap>> | undefined
  let fitCap: IComputedValue<RowCap> | undefined
  return {
    /**
     * #getter
     * Why an explicit read ordering cannot take effect, or `undefined`:
     * one value holds both the gate and the message naming the switch that
     * brings it back. Chain layout takes no `sort`; its rows are
     * chains.
     */
    get sortReadsBlockedReason(): string | undefined {
      return self.unit === 'chain'
        ? 'Chain rows are ordered by chain — turn off "View as pairs/link supplementary alignments" to sort reads'
        : !self.showPileup
          ? 'Turn on "Show pileup" to sort reads'
          : this.collapseSortBlockedReason
    },

    /**
     * #getter
     * Why the collapse leaves no sort to take effect, or `undefined`:
     * every drawn section lays its reads on one row, none opted out by
     * an expand or a drag. A hidden lane or one shown as coverage alone
     * stacks nothing, whatever cap it holds.
     */
    get collapseSortBlockedReason(): string | undefined {
      return self.collapseSections &&
        !self.groupOrder.some(
          g => this.groupRowCaps.has(g.key) && !self.collapsedGroups.has(g.key),
        )
        ? `Every group is drawn on one row — turn off "Show groups as one row"${self.fitHeightToDisplay ? '' : ', or expand a group from its label,'} to sort`
        : undefined
    },

    /**
     * #getter
     * Whether an explicit read ordering can take effect. The track menu's
     * "Sort by" and the context menu's position-anchored sorts both
     * read it.
     */
    get canSortReads() {
      return this.sortReadsBlockedReason === undefined
    },

    /**
     * #getter
     * Whether a single group's pileup height can be set for that group alone,
     * offered by the label chip's expand/fit button and the per-group
     * drag handles. Fit mode refuses: an override there opts a lane out
     * of the fit and overflows the display.
     */
    get canSizeGroupHeights() {
      return self.showPileup && !self.fitHeightToDisplay
    },

    /**
     * #getter
     * The lane sizes in effect, not the set banked. Fit solves one pitch
     * from every lane's full row count, so fit mode ignores the sizes
     * without dropping them; returning to fixed restores them.
     */
    get groupSizesInEffect(): ReadonlyMap<string, GroupSize> {
      return self.fitHeightToDisplay ? NO_GROUP_SIZES : self.groupSizes
    },

    /**
     * #getter
     * Each lane's band stack in px, in stacking order, as
     * `computeStackedSections` reserves it. Fetch-tier inputs only, so
     * the layout reads it without a cycle.
     */
    get laneBandOverheads(): number[] {
      return laneBandOverheads(
        self.laneBandsInput,
        self.groupOrder.map(g => g.key),
        self.arcsResult.inkGroupKeys,
        self.junctionsStripLanes,
      )
    },

    /**
     * #getter
     * The height every lane's band stack takes from the row budget.
     */
    get totalBandOverhead() {
      return sum(this.laneBandOverheads)
    },

    /**
     * #getter
     * The height overrides and "show all" lanes as row caps, keyed by
     * lane — the layout's input. Keeps its identity while the caps
     * compare equal, so a drag frame that moves no cap relays no read and
     * re-bakes no color.
     */
    get groupRowCaps(): ReadonlyMap<string, RowCap> {
      rowCaps ??= stableIdentityComputed(() =>
        groupRowCaps({
          sizes: this.groupSizesInEffect,
          ceilingPx: self.pileupMaxLayoutHeight,
          rowHeight: self.rowHeight,
        }),
      )
      return rowCaps.get()
    },

    /**
     * #getter
     * The cap a lane on the shared fit budget lays out to: its slice of
     * the viewport when grouped outside fit, the display-wide ceiling
     * otherwise, with the policy that set it (a clipped lane reports it
     * as `clippedBy`).
     * Keeps its identity like `groupRowCaps`: its inputs move a px at a
     * time, it moves a row at a time. Grow mode fits to the grow ceiling,
     * fixed/fit to the drag-resizable slot; both read config slots, never
     * the `height` getter, so grow's height → layout chain cannot cycle.
     */
    get fitDefaultCap(): RowCap {
      fitCap ??= stableIdentityComputed(() => this.resolvedFitDefaultCap)
      return fitCap.get()
    },

    /**
     * #getter
     * `fitDefaultCap` recomputed, without the identity it keeps.
     */
    get resolvedFitDefaultCap(): RowCap {
      // A collapsed lane costs band overhead but claims no pileup rows.
      // A fitted pitch splits nothing: it was solved from every lane's
      // full row count, so each lane already has room for all its rows,
      // and an equal slice would hide a deep lane's reads beside a
      // shallow lane's blank ones. Fit with no room for reads has no
      // pitch, and splits like fixed.
      const { order } = self.groupLayoutContext
      return resolveFitDefaultCap({
        splitsViewport: order.length > 1 && !self.isFitting,
        height: self.autoHeight ? self.growMaxHeight : self.fitTargetHeight,
        visibleGroupCount: order.filter(g => !self.collapsedGroups.has(g.key))
          .length,
        rowHeight: self.rowHeight,
        totalOverhead: this.totalBandOverhead,
        maxRows: this.fitCeilingRows,
      })
    },

    /**
     * #getter
     * How many rows each lane needs, in stacking order, laid out
     * uncapped; 0 for a coverage-only lane. Reads the overlaps and the
     * ceiling only, so a fit drag leaves it alone.
     */
    get fitLaneRows(): number[] {
      return fitLaneRows(
        self.groupLayoutContext,
        self.pileupMaxLayoutHeight,
        self.collapsedGroups,
      )
    },

    /**
     * #getter
     * `fitLaneRows` summed.
     */
    get fitRows(): number {
      return sum(this.fitLaneRows)
    },

    /**
     * #getter
     * The `pileup.maxLayoutHeight` ceiling in rows. While fitting it is clamped to the
     * rows the pileup needs, so the quotient holds steady across drag
     * frames and the layout does not re-place every row.
     */
    get fitCeilingRows(): number {
      const ceiling = maxRowsFor(self.pileupMaxLayoutHeight, self.rowHeight)
      return self.isFitting ? Math.min(ceiling, this.fitRows) : ceiling
    },
  }
}

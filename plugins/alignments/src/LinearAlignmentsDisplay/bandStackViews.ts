import { buildSashimiStripKeys } from './groupedDataMaps.ts'
import {
  boundLaneBandHeights,
  dragLaneBand,
  dragPileupHiddenStrip,
  fittedLaneBandHeights,
  laneSlotHeight,
  pileupHiddenBands,
  pileupHiddenHeight,
} from './sectionLayout.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { JunctionFilter } from '../shared/types.ts'
import type {
  ReadConnectionsMode,
  ReadConnectionsPlacement,
  SashimiPlacement,
} from './constants.ts'
import type { LaneBandsInput, StripKey } from './sectionLayout.ts'
import type { BandPlot } from '@jbrowse/core/util/bandLayout'

/** What {@link sashimiStripViews} reads: the fetch and the junction settings. */
export interface SashimiStripHost {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  junctionFilter: JunctionFilter
  effectiveSashimiPlacement: SashimiPlacement
  loadedRegions: ReadonlyMap<number, { refName: string }>
  hiddenGroups: ReadonlySet<string>
}

/** Which junctions draw in the sashimi strip, per lane. */
export function sashimiStripViews(self: SashimiStripHost) {
  return {
    /**
     * #getter
     * Per group, which junctions draw in the sashimi strip (by
     * `junctionKey`): the one sashimi side decision, read by
     * `sashimiStripLanes` to reserve the strip and `themed`'s sashimi
     * feeds to place each arc. refNames come from `loadedRegions`, keeping this
     * a tier-1 (fetch) derivation. A region not yet loaded gets a unique
     * key, so regions not proven to share a chromosome never pool onto
     * one bp line.
     */
    get sashimiStripKeysByGroup() {
      return buildSashimiStripKeys(self.rpcDataMap, {
        filter: self.junctionFilter,
        placement: self.effectiveSashimiPlacement,
        refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
        hidden: self.hiddenGroups,
      })
    },

    /**
     * #getter
     * Group keys whose junctions draw in the sashimi strip, i.e.
     * the lanes that strip is reserved for.
     */
    get sashimiStripLanes(): ReadonlySet<string> {
      return new Set(
        [...this.sashimiStripKeysByGroup]
          .filter(([, down]) => down.size > 0)
          .map(([key]) => key),
      )
    },
  }
}

/** What {@link bandStackViews} reads: the band settings, the lanes and the track's height. */
export interface BandStackHost {
  showCoverage: boolean
  coverageHeight: number
  drawnReadConnections: ReadConnectionsMode
  readConnectionsPlacement: ReadConnectionsPlacement
  readConnectionsHeight: number
  showSashimi: boolean
  sashimiHeight: number
  effectiveSashimiPlacement: SashimiPlacement
  arcsResult: { inkGroupKeys: ReadonlySet<string> }
  sashimiStripLanes: ReadonlySet<string>
  bandPlot: BandPlot
  showPileup: boolean
  autoHeight: boolean
  fitTargetHeight: number
  growMaxHeight: number
  groupOrder: readonly unknown[]
}

/**
 * The band stack above each lane's pileup: as stated and bound, which the row
 * budget and the band drags read, and as drawn, which fills each lane's slot
 * while the pileup is hidden.
 */
export function bandStackViews(self: BandStackHost) {
  return {
    /**
     * #getter
     * A lane's bands as stated: the height slots, the settings
     * and whether any lane has arcs or a sashimi junction bound for its
     * strip.
     */
    get statedLaneBands() {
      return {
        showCoverage: self.showCoverage,
        coverageHeight: self.coverageHeight,
        drawnReadConnections: self.drawnReadConnections,
        readConnectionsDown: self.readConnectionsPlacement === 'below',
        readConnectionsAbove: self.readConnectionsPlacement === 'above',
        readConnectionsHeight: self.readConnectionsHeight,
        showSashimi: self.showSashimi,
        sashimiHeight: self.sashimiHeight,
        sashimiAbove: self.effectiveSashimiPlacement === 'above',
        hasArcs: self.arcsResult.inkGroupKeys.size > 0,
        hasSashimiStripArcs: self.sashimiStripLanes.size > 0,
      }
    },

    /**
     * #getter
     * The three stated band heights bound against `bandPlot` top-down
     * (`boundStackedBands`), since a config or a session snapshot states a
     * height no drag clamped. The same whether or not the pileup shows.
     */
    get statedBandHeights() {
      return boundLaneBandHeights(this.statedLaneBands, self.bandPlot)
    },

    /**
     * #getter
     * The pooled band stack as stated: the bound heights, the settings, and
     * whether any lane has arcs or a sashimi junction bound for its strip.
     * The row budget and the band drags read it, never the fitted stack, so
     * hiding the pileup moves no row pitch and no stated height.
     */
    get laneBandsInput() {
      return { ...this.statedLaneBands, ...this.statedBandHeights }
    },

    /**
     * #getter
     * The px each lane takes while the pileup is hidden: the track's height
     * (`pileupHiddenHeight`) split evenly over the drawn lanes, collapsed ones
     * included, in whole px, so the stack never outgrows the track.
     */
    get laneSlot() {
      return laneSlotHeight(pileupHiddenHeight(self), self.groupOrder.length)
    },

    /**
     * #getter
     * The stated stack the bands fill each lane's slot from while the pileup
     * is hidden, bound against the track's height (`pileupHiddenBands`), as
     * MAF binds its bands with its rows hidden: with coverage, the strips
     * keep their stated heights, leaving the coverage its floor, and the
     * coverage takes the rest; without it, top-down with no floor kept for
     * rows.
     */
    get pileupHiddenBandsInput() {
      return pileupHiddenBands(this.statedLaneBands, pileupHiddenHeight(self))
    },

    /**
     * #getter
     * The band settings each lane reserves its strips from:
     * `laneBandsInput` while the pileup shows,
     * `pileupHiddenBandsInput` while it is hidden.
     */
    get drawnLaneBandsInput() {
      return self.showPileup ? this.laneBandsInput : this.pileupHiddenBandsInput
    },

    /**
     * #getter
     * The three band heights as every consumer draws them: the stated
     * heights while the pileup shows, and while it is hidden the pooled
     * stack fitted to fill `laneSlot` (`fittedLaneBandHeights`): the
     * strips at their stated heights and the coverage taking the rest, or
     * with coverage off, the strips in proportion to their stated heights.
     */
    get bandHeights() {
      return self.showPileup
        ? this.statedBandHeights
        : fittedLaneBandHeights(this.pileupHiddenBandsInput, this.laneSlot)
    },
  }
}

/** What {@link dragStripHeight} reads: both stacks and which one draws. */
export interface StripDragHost {
  showPileup: boolean
  laneBandsInput: LaneBandsInput
  bandPlot: BandPlot
  pileupHiddenBandsInput: LaneBandsInput
  laneSlot: number
}

/**
 * The stated height one drag of strip `key` writes: clamped against the
 * pileup's plot while it shows (`dragLaneBand`), and while it is
 * hidden to the room that leaves each lane's coverage its floor
 * (`dragPileupHiddenStrip`).
 */
export function dragStripHeight(
  self: StripDragHost,
  key: StripKey,
  target: number,
) {
  return self.showPileup
    ? dragLaneBand(self.laneBandsInput, key, self.bandPlot, target)
    : dragPileupHiddenStrip(
        self.pileupHiddenBandsInput,
        key,
        self.laneSlot,
        target,
      )
}

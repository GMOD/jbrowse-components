import { buildSashimiDownKeys } from './groupedDataMaps.ts'
import {
  boundBelowCoverageHeights,
  fittedBelowCoverageHeights,
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
import type { BandPlot } from '@jbrowse/core/util/bandLayout'

/** What {@link sashimiDownViews} reads: the fetch and the junction settings. */
export interface SashimiDownHost {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  junctionFilter: JunctionFilter
  effectiveSashimiPlacement: SashimiPlacement
  loadedRegions: ReadonlyMap<number, { refName: string }>
  hiddenGroups: ReadonlySet<string>
}

/** Which junctions draw in the strip below coverage, per lane. */
export function sashimiDownViews(self: SashimiDownHost) {
  return {
    /**
     * #getter
     * Per group, which junctions draw in the strip below coverage (by
     * `junctionKey`): the one sashimi side decision, read by
     * `sashimiDownArcLanes` to reserve the strip and `themed`'s sashimi
     * feeds to place each arc. refNames come from `loadedRegions`, keeping this
     * a tier-1 (fetch) derivation. A region not yet loaded gets a unique
     * key, so regions not proven to share a chromosome never pool onto
     * one bp line.
     */
    get sashimiDownKeysByGroup() {
      return buildSashimiDownKeys(self.rpcDataMap, {
        filter: self.junctionFilter,
        placement: self.effectiveSashimiPlacement,
        refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
        hidden: self.hiddenGroups,
      })
    },

    /**
     * #getter
     * Group keys whose junctions draw in the strip below coverage, i.e.
     * the lanes that strip is reserved for.
     */
    get sashimiDownArcLanes(): ReadonlySet<string> {
      return new Set(
        [...this.sashimiDownKeysByGroup]
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
  arcsResult: { inkGroupKeys: ReadonlySet<string> }
  sashimiDownArcLanes: ReadonlySet<string>
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
     * The below-coverage bands as stated: the height slots, the settings
     * and whether any lane has arcs or a sashimi junction bound for its
     * strip.
     */
    get statedBelowCoverageBands() {
      return {
        showCoverage: self.showCoverage,
        coverageHeight: self.coverageHeight,
        drawnReadConnections: self.drawnReadConnections,
        readConnectionsDown: self.readConnectionsPlacement === 'down',
        readConnectionsHeight: self.readConnectionsHeight,
        showSashimi: self.showSashimi,
        sashimiHeight: self.sashimiHeight,
        hasArcs: self.arcsResult.inkGroupKeys.size > 0,
        hasSashimiDownArcs: self.sashimiDownArcLanes.size > 0,
      }
    },

    /**
     * #getter
     * The three stated band heights bound against `bandPlot` top-down
     * (`boundStackedBands`), since a config or a session snapshot states a
     * height no drag clamped. The same whether or not the pileup shows.
     */
    get statedBandHeights() {
      return boundBelowCoverageHeights(
        this.statedBelowCoverageBands,
        self.bandPlot,
      )
    },

    /**
     * #getter
     * The pooled band stack as stated: the bound heights, the settings, and
     * whether any lane has arcs or a sashimi junction bound for its strip.
     * The row budget and the band drags read it, never the fitted stack, so
     * hiding the pileup moves no row pitch and no stated height.
     */
    get belowCoverageBandsInput() {
      return { ...this.statedBelowCoverageBands, ...this.statedBandHeights }
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
     * is hidden: bound against the track's height with no floor kept for
     * rows (`pileupHiddenBands`), as MAF binds its bands with its rows hidden.
     */
    get pileupHiddenBandsInput() {
      return pileupHiddenBands(
        this.statedBelowCoverageBands,
        pileupHiddenHeight(self),
      )
    },

    /**
     * #getter
     * The band settings each lane reserves its strips from:
     * `belowCoverageBandsInput` while the pileup shows,
     * `pileupHiddenBandsInput` while it is hidden.
     */
    get drawnBelowCoverageBandsInput() {
      return self.showPileup
        ? this.belowCoverageBandsInput
        : this.pileupHiddenBandsInput
    },

    /**
     * #getter
     * The three band heights as every consumer draws them: the stated
     * heights while the pileup shows, and while it is hidden the pooled
     * stack fitted to fill `laneSlot`, each band in proportion to its
     * stated height.
     */
    get bandHeights() {
      return self.showPileup
        ? this.statedBandHeights
        : fittedBelowCoverageHeights(this.pileupHiddenBandsInput, this.laneSlot)
    },
  }
}

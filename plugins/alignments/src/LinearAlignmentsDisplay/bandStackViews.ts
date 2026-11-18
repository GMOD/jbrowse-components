import { buildJunctionsStripKeys } from './groupedDataMaps.ts'
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
  JunctionsPlacement,
} from './constants.ts'
import type { LaneBandsInput, StripKey } from './sectionLayout.ts'
import type { BandPlot } from '@jbrowse/core/util/bandLayout'

/** What {@link junctionsStripViews} reads: the fetch and the junction settings. */
export interface JunctionsStripHost {
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  junctionFilter: JunctionFilter
  effectiveJunctionsPlacement: JunctionsPlacement
  loadedRegions: ReadonlyMap<number, { refName: string }>
  hiddenGroups: ReadonlySet<string>
}

/** Which junctions draw in the junctions strip, per lane. */
export function junctionsStripViews(self: JunctionsStripHost) {
  return {
    /**
     * #getter
     * Per group, which junctions draw in the junctions strip (by
     * `junctionKey`): the one junctions side decision, read by
     * `junctionsStripLanes` to reserve the strip and `themed`'s junctions
     * feeds to place each arc. refNames come from `loadedRegions`, keeping this
     * a tier-1 (fetch) derivation. A region not yet loaded gets a unique
     * key, so regions not proven to share a chromosome never pool onto
     * one bp line.
     */
    get junctionsStripKeysByGroup() {
      return buildJunctionsStripKeys(self.rpcDataMap, {
        filter: self.junctionFilter,
        placement: self.effectiveJunctionsPlacement,
        refNameFor: i => self.loadedRegions.get(i)?.refName ?? `#${i}`,
        hidden: self.hiddenGroups,
      })
    },

    /**
     * #getter
     * Group keys whose junctions draw in the junctions strip, i.e.
     * the lanes that strip is reserved for.
     */
    get junctionsStripLanes(): ReadonlySet<string> {
      return new Set(
        [...this.junctionsStripKeysByGroup]
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
  showJunctions: boolean
  junctionsHeight: number
  effectiveJunctionsPlacement: JunctionsPlacement
  arcsResult: { inkGroupKeys: ReadonlySet<string> }
  junctionsStripLanes: ReadonlySet<string>
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
     * and whether any lane has arcs or a junction bound for its
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
        showJunctions: self.showJunctions,
        junctionsHeight: self.junctionsHeight,
        junctionsAbove: self.effectiveJunctionsPlacement === 'above',
        hasArcs: self.arcsResult.inkGroupKeys.size > 0,
        hasJunctionsStripArcs: self.junctionsStripLanes.size > 0,
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
     * whether any lane has arcs or a junction bound for its strip.
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

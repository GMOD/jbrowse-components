import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { CoverageSource } from '@jbrowse/alignments-core'

/** What {@link bandPlotViews} reads: the fit target. */
export interface BandPlotHost {
  fitTargetHeight: number
}

/** The plot the coverage, arc and junctions bands are taken from. */
export function bandPlotViews(self: BandPlotHost) {
  return {
    /**
     * #getter
     * The plot the three bands are taken from, which the resize handles
     * drag against and `statedBandHeights` binds within. Leaves the pileup
     * a row whether or not it shows, so hiding it rebinds no stated height.
     * Reads `fitTargetHeight`, not `height`, which derives from the layout
     * these heights feed in grow mode.
     */
    get bandPlot() {
      return {
        height: self.fitTargetHeight,
        floor: MIN_BAND_HEIGHT,
      }
    },
  }
}

/** What {@link shownGroupCoverage} reads: the reads and the hidden sections. */
export interface ShownGroupCoverageHost {
  showCoverage: boolean
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  hiddenGroups: ReadonlySet<string>
}

/**
 * The coverage `coverageStatsViews` scales: every SHOWN group's depths in a
 * region; hidden lanes are excluded.
 */
export function shownGroupCoverage(
  self: ShownGroupCoverageHost,
): CoverageSource {
  return {
    active: () => self.showCoverage,
    regionsAt: index => {
      const hidden = self.hiddenGroups
      return (self.rpcDataMap.get(index)?.groups ?? [])
        .filter(({ key }) => !hidden.has(key))
        .map(({ data }) => data)
    },
  }
}

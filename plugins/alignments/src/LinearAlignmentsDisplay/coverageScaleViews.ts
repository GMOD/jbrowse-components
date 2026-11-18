import {
  computeCoverageTicks,
  computeVisibleCoverageStats,
} from '@jbrowse/alignments-core'
import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { visibleStats } from '@jbrowse/wiggle-core'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { SettledBlocksView } from '@jbrowse/wiggle-core'

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

/** What {@link coverageStatsViews} reads: the frame, the reads and the hidden sections. */
export interface CoverageStatsHost {
  showCoverage: boolean
  view: SettledBlocksView
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>
  hiddenGroups: ReadonlySet<string>
}

/** The depths the shown sections reach in the settled blocks of the frame. */
export function coverageStatsViews(self: CoverageStatsHost) {
  return {
    /**
     * #getter
     * The depth stats of every SHOWN group in the settled blocks;
     * hidden lanes are excluded.
     */
    get statsInView() {
      const hidden = self.hiddenGroups
      return visibleStats({
        active: self.showCoverage,
        view: self.view,
        payloadFor: index => self.rpcDataMap.get(index),
        itemsFor: grouped =>
          grouped.groups
            .filter(({ key }) => !hidden.has(key))
            .map(({ data }) => data),
        accumulate: entries => computeVisibleCoverageStats(entries),
      })
    },
  }
}

/** What {@link coverageTicksViews} reads: the domain and the band's height. */
export interface CoverageTicksHost {
  coverageDepthDomain: [number, number] | undefined
  bandHeights: { coverageHeight: number }
  scaleType: string
  symlogConstant: number
}

/** The coverage band's tick ladder. */
export function coverageTicksViews(self: CoverageTicksHost) {
  return {
    /**
     * #getter
     * The coverage band's own ladder (`computeCoverageTicks`) over the
     * height it is drawn at (`bandHeights`, fitted while the pileup is
     * hidden), which `valueScales` hands the chrome in place of the mixin's.
     * Takes the raw `coverage.encoding.y.scale.constant`, resolved from the
     * same domain as `renderState`, so the labels sit on the bars.
     */
    get coverageTicks() {
      return self.coverageDepthDomain
        ? computeCoverageTicks(
            self.coverageDepthDomain,
            self.bandHeights.coverageHeight,
            self.scaleType,
            self.symlogConstant,
          )
        : undefined
    },
  }
}

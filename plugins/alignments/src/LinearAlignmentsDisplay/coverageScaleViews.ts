import {
  computeCoverageTicks,
  computeVisibleCoverageStats,
  coverageDepthDomain,
} from '@jbrowse/alignments-core'
import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { visibleStats } from '@jbrowse/wiggle-core'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { SettledBlocksView } from '@jbrowse/wiggle-core'

/** What {@link bandPlotViews} reads: the fit target and whether the pileup shows. */
export interface BandPlotHost {
  fitTargetHeight: number
  showPileup: boolean
}

/** The plot the coverage, arc and sashimi bands are taken from. */
export function bandPlotViews(self: BandPlotHost) {
  return {
    /**
     * #getter
     * The plot the three bands are taken from, which the resize handles
     * drag against and `bandHeights` binds within. Leaves the pileup a
     * row while it shows. Reads `fitTargetHeight`, not `height`, which
     * derives from the layout these heights feed in grow mode.
     */
    get bandPlot() {
      return {
        height: self.fitTargetHeight,
        floor: self.showPileup ? MIN_BAND_HEIGHT : 0,
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

/** What {@link coverageDomainViews} reads: the autoscaled domain and its type. */
export interface CoverageDomainHost {
  autoscaledDomain: [number, number] | undefined
  scaleType: string
}

/** The domain the coverage band draws against. */
export function coverageDomainViews(self: CoverageDomainHost) {
  return {
    /**
     * #getter
     */
    get coverageScaleType() {
      return scaleTypeCode(self.scaleType)
    },
    /**
     * #getter
     * The autoscaled depth domain. Undefined until some region holds
     * one.
     */
    get coverageDomain(): [number, number] | undefined {
      return self.autoscaledDomain
    },
    /**
     * #getter
     * The domain the coverage band draws against: `coverageDomain` with a
     * log scale's floor pulled up to one read (see
     * `coverageDepthDomain`). Every consumer reads this one — the y-axis
     * ticks and both renderers' normalizers.
     */
    get coverageDepthDomain() {
      return self.autoscaledDomain
        ? coverageDepthDomain(self.autoscaledDomain, self.scaleType)
        : undefined
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
     * The coverage band's own ladder (`computeCoverageTicks`), which
     * `valueScales` hands the chrome in place of the mixin's. Takes the
     * raw `coverage.encoding.y.scale.constant`, resolved from the same domain as
     * `renderState`, so the labels sit on the bars.
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

import { widenRangeToRules } from '@jbrowse/wiggle-core'

import {
  computeVisibleCoverageDomain,
  coverageDefaultDomain,
} from './coverageDownsampling.ts'

import type { CoverageRegion } from './coverageDownsampling.ts'
import type {
  ScoreStats,
  ValueScaleRule,
  VisibleStats,
} from '@jbrowse/wiggle-core'

/** What {@link coverageAutoscaleViews} reads: the walked depths and the y scale. */
export interface CoverageAutoscaleHost {
  statsInView: VisibleStats<CoverageRegion, ScoreStats> | undefined
  fenceQuantile: number
  scoreRules: ValueScaleRule[]
  scaleZero: boolean
}

/**
 * `ScoreAxisMixin`'s hooks for a coverage band, from which its
 * `autoscaledDomain` resolves. Every display drawing a depth band (the
 * alignments coverage, the MAF coverage) installs this one set.
 */
export function coverageAutoscaleViews(self: CoverageAutoscaleHost) {
  return {
    /**
     * #getter
     * The depth the shown coverage spans, fenced at `fenceQuantile` and
     * widened to the `coverage.encoding.y` rules, so stacked sections share
     * a scale.
     */
    get autoscaleRange(): [number, number] | undefined {
      const walked = self.statsInView
      return walked
        ? widenRangeToRules(
            computeVisibleCoverageDomain({
              stats: walked.stats,
              quantile: self.fenceQuantile,
              entries: walked.entries,
            }),
            self.scoreRules.map(rule => rule.value),
          )
        : undefined
    },
    /**
     * #getter
     * The least and greatest depth in view, unfenced.
     */
    get valuesInView(): [number, number] | undefined {
      const walked = self.statsInView
      return walked ? [walked.stats.scoreMin, walked.stats.scoreMax] : undefined
    },
    /**
     * #getter
     * Depth has a floor of 0 while the axis reaches it, so an unpinned
     * bottom stays there whatever a rule below it asks for; with
     * `coverage.encoding.y.scale.zero` off it spans the depths in view.
     */
    get defaultScoreDomain(): [number | undefined, number | undefined] {
      return coverageDefaultDomain(self.scaleZero)
    },
  }
}

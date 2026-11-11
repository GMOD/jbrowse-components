import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { resolveSymlogConstant, widenRangeToRules } from '@jbrowse/wiggle-core'

import {
  computeVisibleCoverageDomain,
  coverageDefaultDomain,
  coverageDepthDomain,
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

/** What {@link coverageDomainViews} reads: the autoscaled domain and the band's settings. */
export interface CoverageDomainHost {
  autoscaledDomain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  coverageMinAlleleFraction: number
  showCoverageAlleles: boolean
  showInterbase: boolean
}

/** The domain the coverage band draws against, and its scale as the marks take it. */
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
    /**
     * #getter
     * The band's scale and layer switches as `CoverageBandState` spells them,
     * less its rect and colors. The raw symlog slot means "derive from the
     * domain"; it resolves here, where the domain is in hand, so every backend
     * normalizes with one number.
     */
    get coverageScaleState() {
      const [domainMin, domainMax] = this.coverageDepthDomain ?? [0, undefined]
      return {
        domainMin,
        domainMax,
        scaleType: this.coverageScaleType,
        symlogConstant: resolveSymlogConstant(
          domainMin,
          domainMax ?? 0,
          self.symlogConstant,
        ),
        minAlleleFraction: self.coverageMinAlleleFraction,
        showAlleles: self.showCoverageAlleles,
        showInterbase: self.showInterbase,
      }
    },
  }
}

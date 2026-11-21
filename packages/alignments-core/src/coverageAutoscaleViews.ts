import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import {
  resolveSymlogConstant,
  visibleStats,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import {
  computeCoverageTicks,
  computeVisibleCoverageDomain,
  computeVisibleCoverageStats,
  coverageDefaultDomain,
  coverageDepthDomain,
} from './coverageDownsampling.ts'

import type { CoverageRegion } from './coverageDownsampling.ts'
import type {
  ScoreStats,
  SettledBlocksView,
  ValueScaleRule,
  VisibleStats,
  YScaleTicks,
} from '@jbrowse/wiggle-core'

/** What {@link coverageStatsViews} reads: the frame. */
export interface CoverageStatsHost {
  view: SettledBlocksView
}

/**
 * Where a display keeps the depths its coverage band draws: whether the band
 * draws, and the shown coverage of one displayed region, every shown section
 * of it.
 */
export interface CoverageSource {
  active: () => boolean
  regionsAt: (displayedRegionIndex: number) => CoverageRegion[]
}

/**
 * The depths the coverage band shows in the settled blocks of the frame,
 * which `coverageAutoscaleViews` scales against. Every display drawing a
 * depth band installs this one getter over its own `CoverageSource`.
 */
export function coverageStatsViews(
  self: CoverageStatsHost,
  source: CoverageSource,
) {
  return {
    /**
     * #getter
     * The depth stats of what the display's `CoverageSource` shows in the
     * settled blocks.
     */
    get statsInView() {
      return visibleStats({
        active: source.active(),
        view: self.view,
        payloadFor: index => source.regionsAt(index),
        itemsFor: regions => regions,
        accumulate: entries => computeVisibleCoverageStats(entries),
      })
    },
  }
}

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

/** What {@link coverageTicksViews} reads: the domain and its scale. */
export interface CoverageTicksHost {
  coverageDepthDomain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
}

/** The coverage band's tick ladder, over the height `bandHeight` reads. */
export function coverageTicksViews(
  self: CoverageTicksHost,
  bandHeight: () => number,
) {
  return {
    /**
     * #getter
     * The coverage band's own ladder (`computeCoverageTicks`) over the
     * height it is drawn at, which `valueScales` hands the chrome in place
     * of the mixin's. Takes the raw `coverage.encoding.y.scale.constant`,
     * resolved from the same domain as the band's scale, so the labels sit
     * on the bars.
     */
    get coverageTicks(): YScaleTicks | undefined {
      return self.coverageDepthDomain
        ? computeCoverageTicks(
            self.coverageDepthDomain,
            bandHeight(),
            self.scaleType,
            self.symlogConstant,
          )
        : undefined
    },
  }
}

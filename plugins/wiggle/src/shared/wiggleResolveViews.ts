import {
  autoscaleDomainFromStats,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'

import {
  paintedWiggleColor,
  resolveWiggleColor,
  wiggleColorEncoding,
  wiggleMarkColoring,
  wiggleMarkSources,
} from './wiggleColor.ts'

import type { WiggleRendering } from '../renderingTypes.ts'
import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { ResolvedWiggleColor } from './wiggleColor.ts'
import type { Extent } from './wiggleMarkConfigSchema.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Dataset, ScoreStats, SummaryField } from '@jbrowse/wiggle-core'

/**
 * What the resolve views read: the settings and rows a wiggle display has
 * already read, from its config and its row mixin on screen, or from a config
 * and fetched results in a static export.
 */
export interface WiggleResolveHost {
  isDensityMode: boolean
  extent: Extent
  origin: number
  colorSetting: ColorSetting
  summaryField: SummaryField
  renderingType: WiggleRendering
  isRowLayout: boolean
  sources: readonly { name: string; rowColor?: string }[]
  rowPaletteDeals: boolean
  resolvedRowColors: ReadonlyMap<string, string>
  scoreRules: readonly { value: number }[]
}

/**
 * The views that turn a wiggle display's settings and rows into what its
 * encoder paints. The display installs them as a `.views()` layer, so each is
 * its own computed; a static export runs the same getters over a plain host,
 * so the export and the view cannot decide differently.
 */
export function wiggleResolveViews(self: WiggleResolveHost) {
  return {
    /**
     * #getter
     * The extent actually drawn. A heatmap maps score to color and has no
     * min-max presentation, so the autoscale domain reads this rather than
     * the raw slot; otherwise the color ramp spans the min and max while
     * the plot paints one summary, and the score legend reports a range
     * nothing on screen reaches.
     */
    get effectiveExtent(): Extent {
      return self.isDensityMode ? 'none' : self.extent
    },

    /**
     * #getter
     * The color actually painted: what the config says, else the pos/neg
     * pair about the `origin`.
     */
    get effectiveColor(): ColorSetting {
      return paintedWiggleColor(self.colorSetting, {
        rect: self.isDensityMode,
        origin: self.origin,
      })
    },

    /**
     * #getter
     * `effectiveColor` as it paints, through the one resolver every
     * display's color object goes through.
     */
    get colorEncoding() {
      return wiggleColorEncoding(this.effectiveColor)
    },

    /**
     * #getter
     * `colorEncoding` as the encoder and both backends take it.
     */
    get wiggleColor(): ResolvedWiggleColor {
      return resolveWiggleColor(this.colorEncoding, self.origin)
    },

    /**
     * #getter
     * How the plot spends color (`wiggleMarkColoring`): whether the score
     * gradient paints, whether row colors do, and which of a source's
     * colors its marks take.
     */
    get markColoring() {
      return wiggleMarkColoring({
        colorSetting: self.colorSetting,
        wiggleColor: this.wiggleColor,
        rect: self.isDensityMode,
      })
    },

    /**
     * #getter
     * Whether a gradient spends color on the score: any mark under a
     * `linear` color, which a heatmap draws its unset pair as.
     */
    get scoreGradientPaints() {
      return this.markColoring.gradientPaints
    },

    /**
     * #getter
     * `TreeSidebarMixin`'s hook: a subtrack's color paints its plot while
     * the plot colors by `source` (`wiggleColorsBySource`).
     */
    get rowColorPaintsMarks(): boolean {
      return this.markColoring.rowColorPaintsMarks
    },

    /**
     * #getter
     * Each source and the color its marks paint in (`wiggleMarkSources`),
     * which the encoder and the tooltip read.
     */
    get markSources(): { name: string; color?: string }[] {
      return wiggleMarkSources(self.sources, {
        rowColorPaintsMarks: this.rowColorPaintsMarks,
        paletteDeals: self.rowPaletteDeals,
        anyRowColored: self.resolvedRowColors.size > 0,
      })
    },

    /**
     * #getter
     * Scores the axis must reach whatever the data does, so a rule drawn at
     * one stays on it. Empty in density, where no rule is drawn: the domain
     * is spent on the color ramp there, so widening it stretches the ramp
     * over a range nothing on screen reaches.
     */
    get scoreRuleValues(): number[] {
      return self.isDensityMode ? [] : self.scoreRules.map(r => r.value)
    },

    /**
     * #getter
     * The sources the autoscale domain reads: the rows drawn, so a filter
     * that hides sources leaves the axis scaled to the ones shown.
     */
    get autoscaleSourceNames(): Set<string> {
      return new Set(self.sources.map(s => s.name))
    },

    /**
     * #method
     * The row list is this display's own: the encoder places each payload
     * source by its position here, so a filter or a reorder re-uploads
     * bytes already in hand.
     *
     * The color rides here and not in `rpcProps`: the worker ships one set
     * of score arrays and the main thread colors each instance by its side
     * of the cut, so a new color re-encodes and refetches nothing.
     */
    gpuProps(): WiggleGpuProps {
      return {
        wiggleColor: this.wiggleColor,
        origin: self.origin,
        summaryField: self.summaryField,
        effectiveExtent: this.effectiveExtent,
        renderingType: self.renderingType,
        sources: this.markSources,
        rowLayout: self.isRowLayout,
      }
    },
  }
}

/**
 * What the drawn sources span under the autoscale mode, widened to reach every
 * rule, or `undefined` while nothing is walked.
 */
export function wiggleAutoscaleRange(
  walked: { stats: ScoreStats; entries: Dataset[] } | undefined,
  {
    quantile,
    zero,
    field,
    extent,
    ruleValues,
  }: {
    quantile: number
    zero: boolean
    field: string
    extent: string
    ruleValues: number[]
  },
) {
  return walked
    ? widenRangeToRules(
        autoscaleDomainFromStats({
          stats: walked.stats,
          quantile,
          zero,
          field,
          extent,
          visibleEntries: walked.entries,
        }),
        ruleValues,
      )
    : undefined
}

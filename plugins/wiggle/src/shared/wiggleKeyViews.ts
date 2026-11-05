import { keyNames } from '@jbrowse/core/util/categoricalField'
import { thresholdLabels } from '@jbrowse/core/util/thresholdScale'

import { scoreRampScale } from './scoreRampScale.ts'
import { declaredCuts } from './wiggleColor.ts'

import type { ResolvedWiggleColor, wiggleColorEncoding } from './wiggleColor.ts'
import type {
  CategoricalScale,
  ColorScale,
  RampScale,
} from '@jbrowse/core/ui/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/** What {@link wiggleScoreKeyViews} reads: the score scale and its colors. */
export interface WiggleScoreKeyHost {
  domain: [number, number] | undefined
  scaleType: string
  symlogConstant: number
  isDensityMode: boolean
  colorSetting: ColorSetting
  colorEncoding: ReturnType<typeof wiggleColorEncoding>
  /** The `color` object resolved against the origin and the layout. */
  wiggleColor: ResolvedWiggleColor
  /** The heading of the score key: the color's legend title, else the axis title. */
  colorKeyTitle: string
}

/**
 * The keys a wiggle display draws of its scores, the ramp and the threshold
 * bands, which the display and a static export install alike.
 */
export function wiggleScoreKeyViews(self: WiggleScoreKeyHost) {
  return {
    /**
     * #getter
     * The score ramp as a color scale, or undefined when there is no single
     * ramp to describe or no domain yet. `LegendMixin`'s `colorScales` lists
     * it, so the on-screen key and the export draw one bar. The bar is drawn
     * from the resolved color — the same cached LUT bytes both renderers
     * color through — so a declared ramp's key is what the track paints.
     */
    get scoreColorScale(): RampScale | undefined {
      const { rampLut, rampMid } = self.wiggleColor
      return self.domain && rampLut
        ? scoreRampScale(
            self.domain,
            self.scaleType,
            self.symlogConstant,
            { rampLut, rampMid },
            self.colorKeyTitle,
          )
        : undefined
    },
    /**
     * #getter
     * The key a threshold with declared cuts draws: one row per interval,
     * labelled by the span it covers. A threshold cutting at the `origin`
     * draws none, because the axis already shows where the origin is and a
     * `< 0` / `≥ 0` key on every bigWig adds nothing a reader asked
     * for. A heatmap has no axis, so its threshold keys the origin's cut
     * too.
     */
    get thresholdColorScale(): ColorScale | undefined {
      const encoding = self.colorEncoding
      const threshold =
        typeof encoding === 'object' && encoding.scale === 'threshold'
      const declared = declaredCuts(encoding)
      const cuts =
        declared.length > 0 || !self.isDensityMode || !threshold
          ? declared
          : self.wiggleColor.cuts
      if (cuts.length === 0) {
        return undefined
      }
      const { posColor, negColor, innerColors } = self.wiggleColor
      const colors = [negColor, ...innerColors, posColor]
      const { scale } = self.colorSetting
      const spans = thresholdLabels(cuts)
      const names = keyNames(spans, scale.names ?? [])
      return {
        kind: 'categorical',
        id: 'threshold',
        title: self.colorKeyTitle,
        entries: spans.map((span, i) => ({
          value: span,
          label: names.get(span) ?? span,
          color: colors[i]!,
        })),
      }
    },
  }
}

/** What {@link wiggleColorScaleViews} reads: the score keys and the rows. */
export interface WiggleColorScaleHost {
  scoreColorScale: RampScale | undefined
  thresholdColorScale: ColorScale | undefined
  isRowLayout: boolean
  rowColorPaintsMarks: boolean
  rowColorScales: CategoricalScale[]
}

/** A wiggle display's key, which the display and a static export install alike. */
export function wiggleColorScaleViews(self: WiggleColorScaleHost) {
  return {
    /**
     * #getter
     * `LegendMixin`'s hook: the score ramp or threshold key, then the row
     * color key, except in a shared panel painting the score gradient,
     * where no row color shows.
     */
    get colorScales(): ColorScale[] {
      const scales: ColorScale[] = []
      if (self.scoreColorScale) {
        scales.push(self.scoreColorScale)
      }
      if (self.thresholdColorScale) {
        scales.push(self.thresholdColorScale)
      }
      if (self.isRowLayout || self.rowColorPaintsMarks) {
        scales.push(...self.rowColorScales)
      }
      return scales
    },
  }
}

import { toLocale } from '../util/numericUtils.ts'

import type {
  LegendItem,
  LegendSection,
  LegendSpec,
  LegendSwatch,
} from './legendSpec.ts'

/**
 * One value a categorical scale colors. `value` is the datum the color
 * classifies (an SV type, a sample group, an impact tier), `label` how the key
 * names it. A row with no `color` is a note in the key rather than a swatch —
 * "+N more", or a rule the swatches cannot state.
 */
export interface CategoricalEntry {
  value: string
  label: string
  color?: string
  swatches?: LegendSwatch[]
  hidden?: boolean
}

/**
 * A color vocabulary: a finite set of values, each drawn in one color. ADR-094's
 * palette-index and per-instance-value cardinalities both resolve to this once
 * the values are enumerated.
 */
export interface CategoricalScale {
  kind: 'categorical'
  id: string
  title?: string
  entries: CategoricalEntry[]
}

/** One stop of a continuous ramp, `offset` in `[0, 1]`. */
export interface RampStop {
  offset: number
  color: string
  // alpha rides beside the color rather than inside it because SVG exporters
  // support `stop-color` alpha unevenly
  opacity?: number
}

/**
 * A scalar through a color ramp: ADR-094's scalar-through-a-scale
 * cardinality. `stops` are what the painter samples — read them out of the
 * same LUT the GPU uploads (`stopsFromRampLut`) so the bar is byte-identical
 * to the plot. `format` prints the domain ends; `toLocale` by default.
 */
export interface RampScale {
  kind: 'ramp'
  id: string
  title?: string
  domain: [number, number]
  stops: RampStop[]
  format?: (value: number) => string
}

/**
 * What a display says about one of its color channels. A display declares a
 * list of these (`LegendMixin.colorScales`) and the legend derives from it, so
 * the key cannot list a color nothing painted.
 */
export type ColorScale = CategoricalScale | RampScale

// A lone ramp names itself on its row: `FloatingLegend` and `legendEntries`
// draw a section's title only beside other sections, and a bar of numbers
// with nothing saying what they count is not a key.
function rampItem(
  { title, domain: [min, max], stops, format = toLocale }: RampScale,
  lone: boolean,
): LegendItem {
  return {
    label: lone ? (title ?? '') : '',
    gradient: { stops, minLabel: format(min), maxLabel: format(max) },
  }
}

function sectionOf(scale: ColorScale, lone: boolean): LegendSection {
  return {
    id: scale.id,
    title: scale.title,
    items:
      scale.kind === 'categorical'
        ? scale.entries.map(entry => ({ ...entry }))
        : [rampItem(scale, lone)],
  }
}

/**
 * The one derivation of a legend from a display's color scales: a section per
 * scale, in the order declared. On screen `FloatingLegend` renders the result
 * and the export flattens it through `legendEntries`, so the two cannot
 * describe different colors.
 */
export function legendSpecOf(scales: ColorScale[]): LegendSpec {
  return {
    sections: scales.map(scale => sectionOf(scale, scales.length === 1)),
  }
}

/** Whether a scale has anything for a key to show. */
export function colorScaleIsEmpty(scale: ColorScale) {
  return scale.kind === 'categorical' && scale.entries.length === 0
}

import { groupKeyComparator } from '../util/groupKeys.ts'
import { formatScore } from '../util/numericUtils.ts'

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
  // The row naming the absence of a value rather than one of them. It sorts
  // after every value, whatever orders them — its label is an ordinary string
  // to a comparator, and `(no value)` sorts ahead of every letter and digit.
  missing?: boolean
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
  // The channel's declared order, the same word and rule every categorical
  // channel reads (`groupKeyComparator`): the values it lists key first, the
  // rest sorted. Unset leaves `entries` in the order the display built them.
  domain?: readonly string[]
  // Each value names a set of the display's rows, so a click on its key row
  // can focus them (`LegendHost.focusLegendEntry`). A scale coloring features
  // or cells leaves this unset and its rows stay inert.
  focusesRows?: boolean
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
 * to the plot. `format` prints the domain ends; `formatScore` by default, so
 * a domain measured off the data prints `24.4` and not the float it was
 * measured as.
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
  { title, domain, stops, format = formatScore }: RampScale,
  lone: boolean,
): LegendItem {
  const [min, max] = domain
  return {
    label: lone ? (title ?? '') : '',
    gradient: { stops, minLabel: format(min), maxLabel: format(max) },
  }
}

function sectionOf(scale: ColorScale, lone: boolean): LegendSection {
  if (scale.kind !== 'categorical') {
    return { id: scale.id, title: scale.title, items: [rampItem(scale, lone)] }
  }
  const items = scale.entries.map(entry => ({ ...entry }))
  const compare = scale.domain?.length
    ? groupKeyComparator(scale.domain)
    : undefined
  // The sort is stable and the value half is skipped without a domain, so a
  // key a display ordered itself keeps that order and only its no-value row
  // moves.
  items.sort(
    (a, b) => missingRowLast(a, b) || (compare ? compare(a.value, b.value) : 0),
  )
  return {
    id: scale.id,
    title: scale.title,
    items,
    focusesRows: scale.focusesRows,
  }
}

/**
 * The one derivation of a legend from a display's color scales: a section per
 * scale, in the order declared. On screen `FloatingLegend` renders the result
 * and the export flattens it through `legendEntries`, so the two cannot
 * describe different colors.
 *
 * A lone scale names itself: section titles draw only beside other sections,
 * so a lone categorical scale's title becomes the box's (Manhattan's field
 * name over its values) and a lone ramp's goes on its row.
 */
export function legendSpecOf(scales: ColorScale[]): LegendSpec {
  const lone = scales.length === 1 ? scales[0] : undefined
  return {
    title: lone?.kind === 'categorical' ? lone.title : undefined,
    sections: scales.map(scale => sectionOf(scale, scales.length === 1)),
  }
}

/**
 * The no-value row goes after every value, in whatever orders the values: a
 * `domain` never lists it, so ordering by the domain alone ranks it with the
 * values the domain leaves out and the bracket its label starts with floats it
 * above them all. Both places a key is ordered read this — `sectionOf` for the
 * rows it draws, and `derivedColorScale` for the entries it hands back, which a
 * display reads for what its key lists.
 */
export function missingRowLast(
  a: { missing?: boolean },
  b: { missing?: boolean },
) {
  return Number(a.missing ?? false) - Number(b.missing ?? false)
}

/** Whether a scale has anything for a key to show. */
export function colorScaleIsEmpty(scale: ColorScale) {
  return scale.kind === 'categorical' && scale.entries.length === 0
}

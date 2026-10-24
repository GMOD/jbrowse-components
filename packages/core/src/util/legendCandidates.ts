import { summarizePast } from '../ui/colorScale.ts'
import {
  MAX_LEGEND_CANDIDATES,
  MAX_LEGEND_ITEMS,
  legendDistinguishesColors,
} from '../ui/legendSpec.ts'
import { OTHER_VALUES_LABEL } from './categoricalField.ts'
import { abgrToCssRgba, cssColorToABGR } from './colorBits.ts'

import type { CategoricalEntry, CategoricalScale } from '../ui/colorScale.ts'
import type { LegendSwatch } from '../ui/legendSpec.ts'
import type { CategoricalField } from './categoricalField.ts'

// One (row, value, color) combination a worker found while packing its
// features, and the whole of what a derived key is built from. `rowIndex`
// indexes the packer's own row list, because the main thread is the side that
// knows whether that row paints the packed color at all.
export interface LegendCandidate {
  rowIndex: number
  value: string
  // ABGR-packed, as the worker baked it into the painting
  color: number
}

// One row of a derived key: a color and every value painted in it, in
// first-seen order.
export interface LegendEntry {
  values: string[]
  color: number
}

// The longer list the multi-row and multi-way gene keys allow before
// summarizing, `MAX_LEGEND_ITEMS` being every other display's: their rows name
// features, and a locus's genes run past twenty.
export const MAX_LEGEND_ENTRIES = 30

export { MAX_LEGEND_CANDIDATES } from '../ui/legendSpec.ts'

/**
 * Accumulator for the distinct (row, value, color) combinations a packer walks
 * past, in first-seen order and bounded, so the main thread never re-walks the
 * features. Deduped on the whole triple: a row of the union lists every value
 * painted in its color, so a second value on that color has to still be in the
 * list to reach it.
 */
export function createLegendCandidateCollector(
  maxCandidates = MAX_LEGEND_CANDIDATES,
) {
  const candidates: LegendCandidate[] = []
  const seen = new Set<string>()
  return {
    candidates,
    add(rowIndex: number, value: string, color: number) {
      const id = `${rowIndex}\u0000${color}\u0000${value}`
      if (candidates.length < maxCandidates && !seen.has(id)) {
        seen.add(id)
        candidates.push({ rowIndex, value, color })
      }
    },
  }
}

// One region's candidates, plus which of its rows actually paint them: a row
// filtered off screen, or painting a per-row color override, contributes no key
// entry, and only the main thread knows which those are.
export interface LegendCandidateSource {
  candidates: readonly LegendCandidate[]
  rowPaintsCandidateColor: (rowIndex: number) => boolean
}

/**
 * The categorical color key over any number of packed regions: one entry per
 * distinct color listing every value painted in it, colors in first-seen
 * order. Keyed by color rather than by value because hiding a category hides
 * features BY color, so two values sharing one color are one row that names
 * both; a value met in two colors stays with the first.
 */
export function unionLegendCandidates<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
) {
  const rows = new Map<number, LegendEntry>()
  const seenValues = new Set<string>()
  for (const region of regions) {
    const { candidates, rowPaintsCandidateColor } = resolve(region)
    for (const { rowIndex, value, color } of candidates) {
      if (!rowPaintsCandidateColor(rowIndex) || seenValues.has(value)) {
        continue
      }
      seenValues.add(value)
      const row = rows.get(color)
      if (row) {
        row.values.push(value)
      } else {
        rows.set(color, { values: [value], color })
      }
    }
  }
  return [...rows.values()]
}

/**
 * A source whose every entry is a candidate its one row paints: the entries of
 * a scale table `encodeFeatures` resolved, or any walk that met each value in
 * one color.
 */
export function everyRowPaints(
  entries: readonly { value: string; color: number }[],
): LegendCandidateSource {
  return {
    candidates: entries.map(({ value, color }) => ({
      rowIndex: 0,
      value,
      color,
    })),
    rowPaintsCandidateColor: () => true,
  }
}

/**
 * The one categorical key a color channel derives from what a worker painted:
 * the union above over the loaded regions, each row a painted color naming
 * every value in it through `field` and ordered by it. Past `maxItems` rows
 * the scale is `summarize`d, and where every row is one color
 * (`legendDistinguishesColors`) there is no key. A display resolving its own
 * colors hands the
 * candidates its packer recorded; one resolved by `encodeFeatures` hands the
 * entries of the scale tables that came back. Either way the key lists what
 * the painting holds, and a `closed` field's domain besides once anything
 * painted. `title` heads it in place of the field's name, `''` heading
 * nothing, and `swatches` draws a row as something other than its color's box.
 * `besides` are the colors of rows a display lists beside these, which the
 * one-color test counts and the summary threshold does not.
 */
export function derivedColorScale<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
  {
    id,
    field,
    title = field.field,
    maxItems = MAX_LEGEND_ITEMS,
    swatches,
    besides = [],
  }: {
    id: string
    field: CategoricalField
    title?: string
    maxItems?: number
    swatches?: (row: CategoricalEntry & { color: string }) => LegendSwatch[]
    besides?: readonly string[]
  },
): CategoricalScale[] {
  const { unknown } = field
  const noValue = field.key('')
  const painted = unionLegendCandidates(regions, resolve).map(
    ({ values, color }) => {
      const sorted = values.toSorted(field.compare)
      const value = sorted[0]!
      const other =
        unknown !== undefined &&
        sorted.some(v => unknown.paints(v)) &&
        sorted.every(v => v === '' || v === noValue || unknown.paints(v))
      return {
        value,
        values: sorted,
        label: other
          ? OTHER_VALUES_LABEL
          : sorted.map(v => field.label(v)).join(', '),
        color: abgrToCssRgba(color),
        ...(value === '' ? { missing: true } : {}),
      }
    },
  )
  const named = new Set(painted.flatMap(e => e.values))
  const unpainted =
    field.closed && painted.length > 0
      ? field.domain
          .filter(value => !named.has(value))
          .map(value => ({
            value,
            label: field.label(value),
            color: abgrToCssRgba(cssColorToABGR(field.color(value))),
          }))
      : []
  const entries = [...painted, ...unpainted].sort((a, b) =>
    field.compare(a.value, b.value),
  )
  const beside = besides.map(color => ({
    color: abgrToCssRgba(cssColorToABGR(color)),
  }))
  return painted.length > 0 &&
    legendDistinguishesColors([...entries, ...beside])
    ? [
        {
          kind: 'categorical',
          id,
          ...(title ? { title } : {}),
          ...(field.domain.length > 0 ? { domain: field.domain } : {}),
          entries: swatches
            ? entries.map(row => ({ ...row, swatches: swatches(row) }))
            : entries,
          ...summarizePast(entries, maxItems),
        },
      ]
    : []
}

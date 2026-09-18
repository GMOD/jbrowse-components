import { legendIsReadable } from '../ui/legendSpec.ts'
import { abgrToCssRgba } from './colorBits.ts'

import type { ColorScale } from '../ui/colorScale.ts'
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

// How many distinct colors a derived key may name and still BE a key. Past this
// the data is not a categorical vocabulary (a track keyed by unique per-feature
// names), and a list of every feature is the thing a key exists instead of.
//
// A different question from `legendIsReadable`'s lower bar, which asks whether a
// key a display already has is worth the rows it costs.
export const MAX_LEGEND_ENTRIES = 30

// Bound on the candidate list one region ships. Far above MAX_LEGEND_ENTRIES, so
// a vocabulary that is categorical at all crosses whole, and a track with a name
// per feature ships a prefix that reads the same way it would have.
export const MAX_LEGEND_CANDIDATES = 1024

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
 *
 * `[]` when there are more than `maxEntries` distinct colors, where the data is
 * not a categorical vocabulary. `regions` is consumed lazily.
 */
export function unionLegendCandidates<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
  maxEntries = MAX_LEGEND_ENTRIES,
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
        if (rows.size > maxEntries) {
          return []
        }
      }
    }
  }
  return [...rows.values()]
}

/**
 * The one categorical key a color channel derives from what a worker painted:
 * the union above over the loaded regions, each row a painted color naming
 * every value in it through `field` and ordered by it, and nothing where the
 * rows would say nothing (`legendIsReadable`). A display resolving its own colors hands the
 * candidates its packer recorded; one resolved by `encodeFeatures` hands the
 * entries of the scale tables that came back. Either way the key lists what
 * the painting holds.
 */
export function derivedColorScale<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
  {
    id,
    field,
    maxItems,
  }: { id: string; field: CategoricalField; maxItems?: number },
): ColorScale[] {
  const entries = unionLegendCandidates(regions, resolve)
    .map(({ values, color }) => {
      const sorted = values.toSorted(field.compare)
      const value = sorted[0]!
      return {
        value,
        values: sorted,
        label: sorted.map(v => field.label(v)).join(', '),
        color: abgrToCssRgba(color),
        ...(value === '' ? { missing: true } : {}),
      }
    })
    .sort((a, b) => field.compare(a.value, b.value))
  return legendIsReadable(entries, maxItems)
    ? [
        {
          kind: 'categorical',
          id,
          title: field.field,
          ...(field.domain.length > 0 ? { domain: field.domain } : {}),
          entries,
        },
      ]
    : []
}

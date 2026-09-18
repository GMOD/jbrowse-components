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

// One row of a derived key: a color, named by the first value seen in it.
export interface LegendEntry {
  value: string
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
 * features. Deduped on the whole triple: the union takes the first value it
 * sees for a color, so a second value on that color has to still be in the
 * list to carry it.
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
 * distinct color, named by the first value seen in that color, in first-seen
 * order. Keyed by color rather than by value, so each key row is 1:1 with a
 * color — hiding a category hides features BY color, so two values sharing
 * one color collapse to a single row.
 *
 * `[]` when there are more than `maxEntries` distinct colors, where the data is
 * not a categorical vocabulary. `regions` is consumed lazily.
 */
export function unionLegendCandidates<T>(
  regions: Iterable<T>,
  resolve: (region: T) => LegendCandidateSource,
  maxEntries = MAX_LEGEND_ENTRIES,
) {
  const entries: LegendEntry[] = []
  const seenColors = new Set<number>()
  const seenValues = new Set<string>()
  for (const region of regions) {
    const { candidates, rowPaintsCandidateColor } = resolve(region)
    for (const { rowIndex, value, color } of candidates) {
      if (
        rowPaintsCandidateColor(rowIndex) &&
        !seenValues.has(value) &&
        !seenColors.has(color)
      ) {
        seenValues.add(value)
        seenColors.add(color)
        entries.push({ value, color })
        if (entries.length > maxEntries) {
          return []
        }
      }
    }
  }
  return entries
}

/**
 * The one categorical key a color channel derives from what a worker painted:
 * the union above over the loaded regions, each row a painted color named
 * through `field` and ordered by it, and nothing where the rows would say
 * nothing (`legendIsReadable`). A display resolving its own colors hands the
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
    .sort((a, b) => field.compare(a.value, b.value))
    .map(({ value, color }) => ({
      value,
      label: field.label(value),
      color: abgrToCssRgba(color),
      ...(value === '' ? { missing: true } : {}),
    }))
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

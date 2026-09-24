import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { unionLegendCandidates } from '@jbrowse/core/util/legendCandidates'

import { configuredLegendEntries } from '../../shared/configuredLegend.ts'
import { resolveLocalRowIndices } from './featurePainting.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

// A key row: a color and every name painted in it, which `label` joins. A
// category is hidden by name, so a name joining the color later does not
// unhide it.
export interface LegendEntry {
  label: string
  values: string[]
  color: number
}

export function entryHidden(entry: LegendEntry, hidden: ReadonlySet<string>) {
  return entry.values.some(v => hidden.has(v))
}

// Deduped on both halves: a repeated label collides as the React key, and a
// repeated color as the toggle key, so two labels sharing one color would give
// a row whose checkbox blanks its neighbour's features.
export function resolveConfiguredLegend(entries: unknown): LegendEntry[] {
  const seenLabels = new Set<string>()
  const seenColors = new Set<number>()
  const result: LegendEntry[] = []
  for (const e of configuredLegendEntries(entries)) {
    const color = cssColorToABGR(e.color)
    if (!seenLabels.has(e.label) && !seenColors.has(color)) {
      seenLabels.add(e.label)
      seenColors.add(color)
      result.push({ label: e.label, values: [e.label], color })
    }
  }
  return result
}

/**
 * The categorical color key for a per-feature-colored painting. A row with a
 * per-row color override paints every block that one color, so it contributes
 * nothing here — the legend describes the `color` axis, not the row axis. One
 * color keys nothing (`legendIsReadable`), so a `color: 'steelblue'` track gets
 * no key named after its first feature.
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
  compare: (a: string, b: string) => number = compareGroupKeys,
): LegendEntry[] {
  // No region need be read when every row is overridden, which is the default
  // configuration: an unset `color` slot over features with no itemRgb gives
  // every row a palette color.
  if (
    rowColorsByIndex.length > 0 &&
    rowColorsByIndex.every(c => c !== undefined)
  ) {
    return []
  }
  const entries = unionLegendCandidates(regions, data => {
    const rowForLocal = resolveLocalRowIndices(
      data.partitionValues,
      rowIndexByValue,
    )
    return {
      candidates: data.legendCandidates,
      rowPaintsCandidateColor: partitionIndex => {
        const row = rowForLocal[partitionIndex]
        return row !== undefined && rowColorsByIndex[row] === undefined
      },
    }
  })
  return entries.length > 1
    ? entries.map(({ values, color }) => {
        const sorted = values.toSorted(compare)
        return { label: sorted.join(', '), values: sorted, color }
      })
    : []
}

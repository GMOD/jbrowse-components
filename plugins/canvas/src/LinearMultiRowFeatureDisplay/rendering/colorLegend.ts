import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { unionLegendCandidates } from '@jbrowse/core/util/legendCandidates'

import { resolveLocalRowIndices } from './featurePainting.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

// A key row keyed by the name its features carry, so a click hides that
// name's color.
export interface LegendEntry {
  label: string
  color: number
}

interface ConfiguredLegendEntry {
  label: string
  color: string
}

function isConfiguredLegendEntry(e: unknown): e is ConfiguredLegendEntry {
  return (
    typeof e === 'object' &&
    e !== null &&
    'label' in e &&
    typeof e.label === 'string' &&
    'color' in e &&
    typeof e.color === 'string'
  )
}

// Reads the raw (untyped) `legend` config slot, so it validates each entry.
// Deduped on both halves: a repeated label collides as the React key, and a
// repeated color as the toggle key, so two labels sharing one color would give
// a row whose checkbox blanks its neighbour's features.
export function resolveConfiguredLegend(entries: unknown): LegendEntry[] {
  const seenLabels = new Set<string>()
  const seenColors = new Set<number>()
  const result: LegendEntry[] = []
  for (const e of Array.isArray(entries) ? entries : []) {
    if (isConfiguredLegendEntry(e)) {
      const color = cssColorToABGR(e.color)
      if (!seenLabels.has(e.label) && !seenColors.has(color)) {
        seenLabels.add(e.label)
        seenColors.add(color)
        result.push({ label: e.label, color })
      }
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
    ? entries.map(({ values, color }) => ({ label: values.join(', '), color }))
    : []
}

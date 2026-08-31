import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { unionLegendCandidates } from '@jbrowse/core/util/legendCandidates'

import { resolveLocalRowIndices } from './featurePainting.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'
import type { LegendEntry } from '@jbrowse/core/util/legendCandidates'

// A key row is the shared shape — every display deriving a key off packed data
// gets the same rows. Only what "this row paints that color" means is this
// display's own (see buildColorLegend).
export type { LegendEntry }

// An admin-declared legend entry from the `legend` config slot: a CSS color.
interface ConfiguredLegendEntry {
  label: string
  color: string
}

function isConfiguredLegendEntry(e: unknown): e is ConfiguredLegendEntry {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as Record<string, unknown>).label === 'string' &&
    typeof (e as Record<string, unknown>).color === 'string'
  )
}

// Convert the admin-declared `{label, color}` legend (CSS colors) to the ABGR
// LegendEntry the renderer uses, dropping malformed entries. Fed the raw
// (untyped) `legend` config slot, so it validates each entry at runtime. Used
// when the category is encoded only in the block color, so there's no feature
// attribute to auto-derive from (see buildColorLegend).
//
// Deduped first-seen on BOTH halves, matching buildColorLegend. A repeated
// label collides as the React key; a repeated color collides as the toggle key,
// because hiding a category hides features by color (see `hiddenColors`) — so
// two labels sharing one color would give a row whose checkbox blanks its
// neighbour's features while that neighbour keeps a lit swatch.
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
 * Derive the categorical color key for a per-feature-colored painting, off each
 * region's `legendCandidates` — the distinct (row, name, color) combinations the
 * worker packed while it was already walking the features. The union, the
 * color-keyed dedupe and the give-up bar are `unionLegendCandidates`; what this
 * adds is the one thing they can't know, which is whether a row paints those
 * packed colors at all.
 *
 * Only per-feature color mode has an unlabeled vocabulary worth a legend. A row
 * with a per-row color override (palette / sampleColorMap / arrangement dialog)
 * paints every block the row color and is already named by the sidebar labels,
 * so it contributes nothing here — the legend describes the `color` axis, not
 * the row axis. Nor does a partition value with no row on screen (filtered out,
 * or not yet discovered).
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
): LegendEntry[] {
  // Every row painting a per-row color contributes nothing, so when that is
  // *all* of them there is no legend to find and no region need be read. That is
  // not an edge case: it is the default configuration — an unset `color` slot
  // over features with no itemRgb gives every row a palette color.
  if (
    rowColorsByIndex.length > 0 &&
    rowColorsByIndex.every(c => c !== undefined)
  ) {
    return []
  }
  return unionLegendCandidates(regions, data => {
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
}

import { resolveLocalRowIndices } from './resolveLocalRowIndices.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

export interface LegendEntry {
  label: string
  // ABGR-packed per-feature color
  color: number
}

// A key with more distinct labels than this isn't a categorical vocabulary
// (e.g. a track keyed by unique per-feature names) — show nothing rather than an
// unusably long list.
const MAX_LEGEND_ENTRIES = 30

/**
 * Derive the categorical color key for a per-feature-colored painting: the
 * distinct `(featureName -> per-feature color)` pairs, in first-seen order.
 *
 * Only per-feature color mode has an unlabeled vocabulary worth a legend. Rows
 * with a per-row color override (palette / sampleColorMap / arrangement dialog)
 * paint every block the row color and are already named by the sidebar labels,
 * so they contribute nothing here — the legend describes the `color` axis, not
 * the row axis. Returns `[]` when there's no categorical signal (unnamed
 * features, or more than `MAX_LEGEND_ENTRIES` distinct names).
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
): LegendEntry[] {
  const byLabel = new Map<string, number>()
  for (const data of regions) {
    const rowForLocal = resolveLocalRowIndices(
      data.partitionValues,
      rowIndexByValue,
    )
    const { featureNames, featureColors, featurePartitionIndex } = data
    for (let i = 0; i < featureNames.length; i++) {
      const row = rowForLocal[featurePartitionIndex[i]!]
      const label = featureNames[i]!
      if (
        row !== undefined &&
        rowColorsByIndex[row] === undefined &&
        label &&
        !byLabel.has(label)
      ) {
        byLabel.set(label, featureColors[i]!)
        if (byLabel.size > MAX_LEGEND_ENTRIES) {
          return []
        }
      }
    }
  }
  return [...byLabel].map(([label, color]) => ({ label, color }))
}

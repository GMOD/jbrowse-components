import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { resolveLocalRowIndices } from './resolveLocalRowIndices.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

export interface LegendEntry {
  label: string
  // ABGR-packed per-feature color
  color: number
}

// An admin-declared legend entry from the `legend` config slot: a CSS color.
export interface ConfiguredLegendEntry {
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
// Labels are deduped first-seen: a label is both the React key and the
// `hiddenColors` toggle key (see model), so a repeated label would collide and
// map one toggle to several colors. Matches buildColorLegend's per-label
// uniqueness.
export function resolveConfiguredLegend(entries: unknown): LegendEntry[] {
  const seenLabels = new Set<string>()
  const result: LegendEntry[] = []
  for (const e of Array.isArray(entries) ? entries : []) {
    if (isConfiguredLegendEntry(e) && !seenLabels.has(e.label)) {
      seenLabels.add(e.label)
      result.push({ label: e.label, color: cssColorToABGR(e.color) })
    }
  }
  return result
}

// A key with more distinct labels than this isn't a categorical vocabulary
// (e.g. a track keyed by unique per-feature names) — show nothing rather than an
// unusably long list.
const MAX_LEGEND_ENTRIES = 30

/**
 * Derive the categorical color key for a per-feature-colored painting: one entry
 * per distinct per-feature color, labeled by the first name seen in that color,
 * in first-seen order.
 *
 * Entries are keyed by color (not name) so each legend row is 1:1 with a color.
 * Toggling a category hides features *by color* (see `hiddenColors`), so a color
 * shared by two names must collapse to a single row — otherwise one swatch would
 * appear twice and toggling either would hide both. A name reused across two
 * colors keeps its first-seen color.
 *
 * Only per-feature color mode has an unlabeled vocabulary worth a legend. Rows
 * with a per-row color override (palette / sampleColorMap / arrangement dialog)
 * paint every block the row color and are already named by the sidebar labels,
 * so they contribute nothing here — the legend describes the `color` axis, not
 * the row axis. Returns `[]` when there's no categorical signal (unnamed
 * features, or more than `MAX_LEGEND_ENTRIES` distinct colors).
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
): LegendEntry[] {
  const entries: LegendEntry[] = []
  const seenColors = new Set<number>()
  const seenLabels = new Set<string>()
  for (const data of regions) {
    const rowForLocal = resolveLocalRowIndices(
      data.partitionValues,
      rowIndexByValue,
    )
    const { featureNames, featureColors, featurePartitionIndex } = data
    for (let i = 0; i < featureNames.length; i++) {
      const row = rowForLocal[featurePartitionIndex[i]!]
      const label = featureNames[i]!
      const color = featureColors[i]!
      if (
        row !== undefined &&
        rowColorsByIndex[row] === undefined &&
        label &&
        !seenLabels.has(label) &&
        !seenColors.has(color)
      ) {
        seenLabels.add(label)
        seenColors.add(color)
        entries.push({ label, color })
        if (entries.length > MAX_LEGEND_ENTRIES) {
          return []
        }
      }
    }
  }
  return entries
}

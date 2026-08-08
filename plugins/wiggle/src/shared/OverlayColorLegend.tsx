import { SvgColorLegend } from '@jbrowse/core/ui'

interface LegendSource {
  name: string
  label?: string
  color?: string
  group?: string
}

interface LegendEntry {
  key: string
  label: string
  color?: string
}

// A grouped track's key is one row per (group, color) pair, in first-appearance
// order. Almost always that is one row per group, since a group normally shares
// a color — the pair is what a group whose sources DISAGREE about their color
// collapses to instead of falling apart.
//
// Both halves are real and the second is not a corner case. A user overriding
// one sample's color splits its group in two, and a store may simply carry a
// coloring finer than its grouping: the per-cell PBMC store groups its 4,390
// cells into six lineages and colors them by nine cell types, so 'T cell' is
// two blues. Per-source entries there would be 2,436 rows for that one group,
// which is not a key; two swatches labelled 'T cell' is, and it says something
// true about the data rather than hiding it.
// The key a color legend draws, in first-appearance order over the sources.
//
// A grouped source contributes one row per (group, color) pair. Almost always
// that is one row per group, since a group normally shares a color — the pair
// is what a group whose sources DISAGREE about their color collapses to
// instead of falling apart.
//
// Both halves are real and the second is not a corner case. A user overriding
// one sample's color splits its group in two, and a store may simply carry a
// coloring finer than its grouping: the per-cell PBMC store groups its 4,390
// cells into six lineages and colors them by nine cell types, so 'T cell' is
// two blues. Per-source entries there would be 2,436 rows for that one group,
// which is not a key; two swatches labelled 'T cell' is, and it says something
// true about the data rather than hiding it.
//
// An ungrouped source keeps an entry of its own, since nothing else identifies
// it.
//
// Exported so a caller can COUNT the entries before deciding to draw a key at
// all: the collapse is what makes a 4,390-row track's key nine rows, and
// whether it collapses is a property of the data rather than of the row count.
// `overlayLegendApplies` asks this rather than guessing from `numSources`.
export function buildLegendEntries(sources: LegendSource[]): LegendEntry[] {
  const seen = new Set<string>()
  const entries: LegendEntry[] = []
  for (const s of sources) {
    if (s.group === undefined) {
      entries.push({ key: s.name, label: s.label ?? s.name, color: s.color })
      continue
    }
    const key = `group:${s.group}:${s.color ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      entries.push({ key, label: s.group, color: s.color })
    }
  }
  return entries
}

export default function OverlayColorLegend({
  sources,
  fallbackColor,
  canvasWidth,
  maxHeight,
  onDismiss,
}: {
  sources: LegendSource[]
  fallbackColor: string
  canvasWidth: number
  // the display height — caps the legend so it never overflows the track
  maxHeight: number
  // on-screen only: adds the "×" dismiss button (omitted on the SVG export)
  onDismiss?: () => void
}) {
  const entries = buildLegendEntries(sources)
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      onDismiss={onDismiss}
      entries={entries.map(e => ({
        key: e.key,
        label: e.label,
        color: e.color ?? fallbackColor,
      }))}
    />
  )
}

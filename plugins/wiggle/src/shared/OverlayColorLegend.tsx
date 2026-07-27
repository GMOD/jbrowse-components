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

// Each group's shared color, or `consistent: false` when its sources disagree
// (e.g. the user explicitly overrode one sample) and so can't be collapsed.
function groupColors(sources: LegendSource[]) {
  const out = new Map<string, { color?: string; consistent: boolean }>()
  for (const { group, color } of sources) {
    if (group !== undefined) {
      const seen = out.get(group)
      out.set(group, {
        color: seen ? seen.color : color,
        consistent: seen ? seen.consistent && seen.color === color : true,
      })
    }
  }
  return out
}

// When sources have groups and every source within a group shares the same
// color, collapse to one legend entry per group (showing the group name) so
// a 50-source track with 2 groups shows 2 legend rows, not 50.
// Ungrouped sources and inconsistent groups keep their per-source entries.
function buildLegendEntries(sources: LegendSource[]): LegendEntry[] {
  const groups = groupColors(sources)
  const emitted = new Set<string>()
  const entries: LegendEntry[] = []
  for (const s of sources) {
    const group = s.group
    const shared = group === undefined ? undefined : groups.get(group)
    if (group !== undefined && shared?.consistent) {
      if (!emitted.has(group)) {
        emitted.add(group)
        entries.push({
          key: `group:${group}`,
          label: group,
          color: shared.color,
        })
      }
    } else {
      entries.push({
        key: s.name,
        label: s.label ?? s.name,
        color: s.color,
      })
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

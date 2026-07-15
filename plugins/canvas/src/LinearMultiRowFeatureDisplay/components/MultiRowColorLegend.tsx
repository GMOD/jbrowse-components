import { SvgColorLegend } from '@jbrowse/core/ui'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { LegendEntry } from '../rendering/colorLegend.ts'

// Adapts the multi-row per-feature color key (ABGR LegendEntry + hidden-label
// set) to the shared SvgColorLegend. Labels are unique (see buildColorLegend),
// so a label doubles as the React key.
export default function MultiRowColorLegend({
  entries,
  canvasWidth,
  maxHeight,
  hiddenLabels,
  onDismiss,
}: {
  entries: LegendEntry[]
  canvasWidth: number
  // the display height — caps the legend so it never overflows the track
  maxHeight: number
  // labels toggled off — rendered dimmed (the row-filter itself lives in the
  // model; this is just the visual cue)
  hiddenLabels: ReadonlySet<string>
  // on-screen only: adds the "×" dismiss button (omitted on the SVG export,
  // which can't be clicked)
  onDismiss?: () => void
}) {
  return (
    <SvgColorLegend
      canvasWidth={canvasWidth}
      maxHeight={maxHeight}
      onDismiss={onDismiss}
      entries={entries.map(e => ({
        key: e.label,
        label: e.label,
        color: abgrToCssRgba(e.color),
        hidden: hiddenLabels.has(e.label),
      }))}
    />
  )
}

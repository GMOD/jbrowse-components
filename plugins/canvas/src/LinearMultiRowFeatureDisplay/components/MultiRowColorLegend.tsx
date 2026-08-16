import { SvgColorLegend, legendEntries } from '@jbrowse/core/ui'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { LegendEntry } from '../rendering/colorLegend.ts'
import type { LegendItem } from '@jbrowse/core/ui'

// Adapts this display's two color vocabularies to the shared SvgColorLegend.
//
// They are genuinely two: `entries` keys the per-feature painting and its rows
// are toggleable (`hiddenLabels` dims a category the model has filtered out),
// while `rowGroupItems` keys the sidebar's row-group stripe and names ROWS, not
// features — it is not toggleable and appears only when the rows are too short
// to write their own names (see `rowGroupLegend`). Kept as sections rather than
// one merged list so a reader can tell which axis a swatch is about, and routed
// through `legendEntries` so the titles-only-when-more-than-one rule is the
// shared one rather than a second copy of it.
export default function MultiRowColorLegend({
  entries,
  rowGroupItems,
  canvasWidth,
  maxHeight,
  hiddenLabels,
  onDismiss,
}: {
  entries: LegendEntry[]
  rowGroupItems: LegendItem[]
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
      testid="multirow-color-legend"
      entries={legendEntries({
        sections: [
          {
            id: 'features',
            title: 'Feature colors',
            items: entries.map(e => ({
              label: e.label,
              color: abgrToCssRgba(e.color),
              // Dimmed here rather than over the finished list, because
              // `hiddenLabels` is the FEATURE categories and `legendEntries`
              // also emits the row-group rows and both section titles. Struck
              // through those, a row group sharing a name with a hidden
              // category read as toggled off with nothing able to toggle it
              // back — row groups name rows and are not toggleable at all.
              hidden: hiddenLabels.has(e.label),
            })),
          },
          { id: 'rowGroups', title: 'Row groups', items: rowGroupItems },
        ],
      })}
    />
  )
}

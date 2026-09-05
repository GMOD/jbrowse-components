import { SvgColorLegend, legendEntries } from '@jbrowse/core/ui'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { LegendEntry } from '../rendering/colorLegend.ts'
import type { LegendItem } from '@jbrowse/core/ui'

// Two vocabularies, kept as separate sections: `entries` keys the per-feature
// painting and is toggleable, while `rowGroupItems` names rows and is not.
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
  maxHeight: number
  hiddenLabels: ReadonlySet<string>
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
              // dimmed here rather than over the finished list, which also
              // holds the row-group rows `hiddenLabels` says nothing about
              hidden: hiddenLabels.has(e.label),
            })),
          },
          { id: 'rowGroups', title: 'Row groups', items: rowGroupItems },
        ],
      })}
    />
  )
}

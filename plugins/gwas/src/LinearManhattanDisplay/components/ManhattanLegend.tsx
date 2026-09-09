import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'

import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

// The color key, whichever scheme is drawing it: the r² bins under LD
// coloring, the field's values under field coloring. Takes the display's
// `legend` value, the same one the SVG export flattens, so the two cannot
// list different colors.
export default function ManhattanLegend({
  legend,
  onDismiss,
}: {
  legend: LegendSpec
  onDismiss?: () => void
}) {
  return (
    <FloatingLegend
      title={legend.title}
      items={legend.items}
      onDismiss={onDismiss}
    />
  )
}

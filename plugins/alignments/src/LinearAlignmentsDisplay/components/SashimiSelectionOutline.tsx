import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// The mark on the junction the sashimi detail widget is showing, painted UNDER
// the arc so the junction keeps its strand tint while you inspect it. Shared by
// the overlay and the export, which draw the same selection.
export default function SashimiSelectionOutline({
  arc,
  palette,
}: {
  arc: SashimiArc
  palette: JBrowsePalette
}) {
  return (
    <path
      d={arc.d}
      stroke={palette.text.primary}
      strokeWidth={arc.strokeWidth + 4}
      fill="none"
      style={{ pointerEvents: 'none' }}
    />
  )
}

import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import {
  JUNCTION_LABEL_FONT_SIZE,
  JUNCTION_LABEL_HALO_WIDTH,
} from '../../features/junctions/computeOverlay.ts'

import type { JunctionLabel } from '../renderers/junctionMarks.ts'

// The read count at each arc's apex, shared by the overlay and the export. The
// halo is the surface color, so it reads in either theme.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function JunctionLabels({
  labels,
}: {
  labels: readonly JunctionLabel[]
}) {
  const palette = usePalette()
  return labels.map(label => (
    <text
      key={label.key}
      x={label.x}
      y={label.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={JUNCTION_LABEL_FONT_SIZE}
      fill={palette.text.primary}
      stroke={palette.background.paper}
      strokeWidth={JUNCTION_LABEL_HALO_WIDTH}
      paintOrder="stroke"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {label.count}
    </text>
  ))
}

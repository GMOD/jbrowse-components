import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { SvgHaloText, TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'

import {
  JUNCTION_LABEL_FONT_SIZE,
  JUNCTION_LABEL_HALO_WIDTH,
} from '../../features/junctions/computeOverlay.ts'

import type { JunctionLabel } from '../renderers/junctionMarks.ts'

// The read count at each arc's apex, centred on it, shared by the overlay and
// the export. The halo is the surface color, so it reads in either theme.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function JunctionLabels({
  labels,
}: {
  labels: readonly JunctionLabel[]
}) {
  const palette = usePalette()
  return labels.map(label => (
    <g key={label.key} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <SvgHaloText
        x={label.x}
        y={label.y + JUNCTION_LABEL_FONT_SIZE * (TEXT_BASELINE_RATIO - 0.5)}
        anchor="middle"
        fontSize={JUNCTION_LABEL_FONT_SIZE}
        fill={palette.text.primary}
        halo={palette.background.paper}
        haloWidth={JUNCTION_LABEL_HALO_WIDTH}
      >
        {label.count}
      </SvgHaloText>
    </g>
  ))
}

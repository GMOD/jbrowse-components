import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import {
  SASHIMI_LABEL_FONT_SIZE,
  SASHIMI_LABEL_HALO_WIDTH,
} from '../../features/sashimi/computeOverlay.ts'
import { sashimiArcKey } from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'

// The read count at each arc's apex, shared by the overlay and the export, as a
// pass of its own after the paths so a heavy arc's stroke cannot bury a lighter
// one's count. The halo is the surface colour, so it reads in either theme.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function SashimiArcLabels({
  arcs,
  show,
}: {
  arcs: SashimiArc[]
  show: boolean
}) {
  const palette = usePalette()
  return show
    ? arcs
        .filter(arc => arc.showLabel)
        .map(arc => (
          <text
            key={sashimiArcKey(arc)}
            x={arc.labelX}
            y={arc.labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={SASHIMI_LABEL_FONT_SIZE}
            fill={palette.text.primary}
            stroke={palette.background.paper}
            strokeWidth={SASHIMI_LABEL_HALO_WIDTH}
            paintOrder="stroke"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {arc.score}
          </text>
        ))
    : null
}

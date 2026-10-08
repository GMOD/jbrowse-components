import { usePalette } from '@jbrowse/core/ui/PaletteContext'

import {
  SASHIMI_LABEL_FONT_SIZE,
  SASHIMI_LABEL_HALO_WIDTH,
} from '../../features/sashimi/computeOverlay.ts'

import type { SashimiLabel } from '../../features/sashimi/computeOverlay.ts'

// The read count at each arc's apex, shared by the overlay and the export. The
// halo is the surface colour, so it reads in either theme.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export default function SashimiLabels({ labels }: { labels: SashimiLabel[] }) {
  const palette = usePalette()
  return labels.map(label => (
    <text
      key={label.key}
      x={label.x}
      y={label.y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={SASHIMI_LABEL_FONT_SIZE}
      fill={palette.text.primary}
      stroke={palette.background.paper}
      strokeWidth={SASHIMI_LABEL_HALO_WIDTH}
      paintOrder="stroke"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {label.count}
    </text>
  ))
}

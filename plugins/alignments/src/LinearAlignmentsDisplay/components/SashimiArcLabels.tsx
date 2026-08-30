import {
  SASHIMI_LABEL_FONT_SIZE,
  SASHIMI_LABEL_HALO_WIDTH,
} from '../../features/sashimi/computeOverlay.ts'
import { sashimiArcKey } from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

// Read-count label at a sashimi arc's apex, shared by the on-screen overlay and
// the SVG export so the two can't drift. The halo (paint-order: stroke) keeps
// the count legible over both the arc and the coverage histogram behind it — the
// SVG equivalent of MISO sashimi_plot's white text background box.
//
// Both colors come from the palette rather than the hardcoded #222-on-#fff this
// used to draw: in dark mode that pair inverted into a glaring white blob on the
// dark track background, the same way the selection stroke's old '#333' vanished
// into it. Painting `background.paper` behind `text.primary` is the halo's
// intent — "the surface this sits on" — in either mode.
function SashimiArcLabel({
  x,
  y,
  score,
  color,
  haloColor,
}: {
  x: number
  y: number
  score: number
  color: string
  haloColor: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={SASHIMI_LABEL_FONT_SIZE}
      fill={color}
      stroke={haloColor}
      strokeWidth={SASHIMI_LABEL_HALO_WIDTH}
      paintOrder="stroke"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {score}
    </text>
  )
}

// Every visible count label for one sub-band, as a pass of its own. Both the
// overlay and the export emit their arc paths first and this second, so a label
// is never buried under a neighbouring arc's stroke — arcs are painted ascending
// by score (`projectSashimiArcs` sorts them), so without the split a heavy
// junction's thick stroke swallowed the count of the lighter one it overlaps.
// `showLabel` is the compute layer's per-arc "the text fits in this span"
// verdict; `show` is the display setting.
export default function SashimiArcLabels({
  arcs,
  show,
  palette,
}: {
  arcs: SashimiArc[]
  show: boolean
  palette: JBrowsePalette
}) {
  return show
    ? arcs
        .filter(arc => arc.showLabel)
        .map(arc => (
          <SashimiArcLabel
            key={sashimiArcKey(arc)}
            x={arc.labelX}
            y={arc.labelY}
            score={arc.score}
            color={palette.text.primary}
            haloColor={palette.background.paper}
          />
        ))
    : null
}

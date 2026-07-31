import { SASHIMI_LABEL_FONT_SIZE } from '../../features/sashimi/computeOverlay.ts'
import { sashimiArcKey } from './sashimiArcs.ts'

import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'

// Read-count label at a sashimi arc's apex, shared by the on-screen overlay and
// the SVG export so the two can't drift. The white halo (paint-order: stroke)
// keeps the count legible over both the arc and the coverage histogram behind
// it — the SVG equivalent of MISO sashimi_plot's white text background box.
function SashimiArcLabel({
  x,
  y,
  score,
}: {
  x: number
  y: number
  score: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={SASHIMI_LABEL_FONT_SIZE}
      fill="#222"
      stroke="#fff"
      strokeWidth={2.5}
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
// by score, so without the split a heavy junction's thick stroke swallowed the
// count of the lighter one it overlaps. `showLabel` is the compute layer's
// per-arc "the text fits in this span" verdict; `show` is the display setting.
export default function SashimiArcLabels({
  arcs,
  show,
}: {
  arcs: SashimiArc[]
  show: boolean
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
          />
        ))
    : null
}

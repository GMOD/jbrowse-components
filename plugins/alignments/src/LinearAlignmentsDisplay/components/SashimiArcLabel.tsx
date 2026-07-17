import { SASHIMI_LABEL_FONT_SIZE } from '../../features/sashimi/computeOverlay.ts'

// Read-count label at a sashimi arc's apex, shared by the on-screen overlay and
// the SVG export so the two can't drift. The white halo (paint-order: stroke)
// keeps the count legible over both the arc and the coverage histogram behind
// it — the SVG equivalent of MISO sashimi_plot's white text background box.
export default function SashimiArcLabel({
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

import { measureText } from '@jbrowse/core/util'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { LegendEntry } from '../rendering/colorLegend.ts'

// measureText uses a Helvetica width table, but the <text> below has no
// font-family and renders in the wider app font, so pad the estimate before
// sizing the paper behind a label or it clips. Matches wiggle's legend.
const APP_FONT_WIDTH_RATIO = 1.1
const ROW_HEIGHT = 14
const FONT_SIZE = 10
const SWATCH = 10
const TEXT_LEFT = 16

// SVG color-key for a per-feature-colored painting (e.g. chromHMM states). One
// swatch + label per distinct feature color, top-right of the view. An SVG `<g>`
// so the on-screen overlay and the SVG export share one renderer. Draws nothing
// when there are no entries.
export default function MultiRowColorLegend({
  entries,
  canvasWidth,
}: {
  entries: LegendEntry[]
  canvasWidth: number
}) {
  let maxLabelWidth = 0
  for (const e of entries) {
    const w = measureText(e.label, FONT_SIZE) * APP_FONT_WIDTH_RATIO
    if (w > maxLabelWidth) {
      maxLabelWidth = w
    }
  }
  const totalWidth = TEXT_LEFT + maxLabelWidth + 6
  const x = Math.max(0, canvasWidth - totalWidth - 4)
  return entries.length ? (
    <g transform={`translate(${x} 0)`}>
      {entries.map((entry, idx) => {
        const y = idx * ROW_HEIGHT
        return (
          <g key={entry.label}>
            <rect
              x={0}
              y={y}
              width={totalWidth}
              height={ROW_HEIGHT}
              fill="rgba(255,255,255,0.8)"
            />
            <rect
              x={2}
              y={y + 2}
              width={SWATCH}
              height={SWATCH}
              fill={abgrToCssRgba(entry.color)}
            />
            <text x={TEXT_LEFT} y={y + 11} fontSize={FONT_SIZE} fill="black">
              {entry.label}
            </text>
          </g>
        )
      })}
    </g>
  ) : null
}

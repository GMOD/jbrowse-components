import { measureText } from '../util/index.ts'

export interface ColorLegendEntry {
  // React key; keep distinct across entries
  key: string
  label: string
  // any CSS color
  color: string
  // toggled-off entries render dimmed and struck through
  hidden?: boolean
}

// measureText uses a Helvetica width table, but these <text> nodes have no
// font-family and render in the wider app font (Roboto), so pad the estimate
// before sizing the paper behind a label or it clips.
const APP_FONT_WIDTH_RATIO = 1.1
const ROW_HEIGHT = 14
const FONT_SIZE = 10
const SWATCH = 10
const TEXT_LEFT = 16

// Shared SVG categorical color key: one translucent row per entry, each a swatch
// + label, right-aligned within canvasWidth. Used by any display that colors by
// a discrete vocabulary (wiggle multi-source overlays, multi-row per-feature
// paintings). A <g> so the on-screen overlay and the SVG export share one
// renderer; draws nothing when entries is empty.
export default function SvgColorLegend({
  entries,
  canvasWidth,
}: {
  entries: ColorLegendEntry[]
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
          <g key={entry.key} opacity={entry.hidden ? 0.35 : 1}>
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
              fill={entry.color}
            />
            <text
              x={TEXT_LEFT}
              y={y + 11}
              fontSize={FONT_SIZE}
              fill="black"
              textDecoration={entry.hidden ? 'line-through' : undefined}
            >
              {entry.label}
            </text>
          </g>
        )
      })}
    </g>
  ) : null
}

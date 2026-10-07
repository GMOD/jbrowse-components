import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import { DEFAULT_RULE_COLOR } from './yAxisConstants.ts'

/**
 * One horizontal rule across a score plot at a chosen value, placed in the
 * plot's own pixel space; `label` is free text the reader chose.
 */
export interface ScoreRuleMark {
  value: number
  y: number
  label?: string
  color?: string
}

const LABEL_FONT_SIZE = 10
const LABEL_GAP = 2

// Above its line, unless the band's top edge leaves the label no room: a rule
// at the top of the axis, like a pinned maximum, captions itself below.
function labelY(y: number, offsetY: number) {
  return y >= LABEL_FONT_SIZE + LABEL_GAP
    ? offsetY + y - LABEL_GAP
    : offsetY + y + LABEL_FONT_SIZE + LABEL_GAP
}

// Bare marks, no wrapping <svg>, so the on-screen overlay and the SVG export
// draw the same elements from the same y. Same split as CrossHatchLines.
// eslint-disable-next-line no-restricted-syntax -- drawn inside a frozen SVG figure
export function ScoreRuleLines({
  marks,
  width,
  offsetY = 0,
}: {
  marks: ScoreRuleMark[]
  width: number
  offsetY?: number
}) {
  // A caption sits over the plot, not beside it, so it needs the halo the tick
  // labels next to it already draw (YScaleBar) — without one a rule crossing
  // filled bars captions itself in grey on the fill and cannot be read. From
  // the palette rather than a hardcoded white, which inverts into a glare in
  // dark mode.
  const haloColor = usePalette().background.default
  return (
    <>
      {marks.map(({ value, label, color, y }) => {
        const lineY = offsetY + y
        const stroke = color ?? DEFAULT_RULE_COLOR
        return (
          <g key={`${value}-${y}`}>
            <line
              x1={0}
              x2={width}
              y1={lineY}
              y2={lineY}
              stroke={stroke}
              // separate attribute rather than an rgba() string: the SVG
              // export's renderToStaticMarkup strips rgba() alpha
              strokeOpacity={0.9}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {label ? (
              // right-hand end: the left is where the y-axis and its tick
              // labels already are
              <text
                x={width - 4}
                y={labelY(y, offsetY)}
                textAnchor="end"
                fontSize={LABEL_FONT_SIZE}
                // full alpha, unlike the line: 0.9 is there to let the rule
                // recede into the plot, and a caption that has to be read wants
                // the opposite
                fill={stroke}
                stroke={haloColor}
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                {label}
              </text>
            ) : null}
          </g>
        )
      })}
    </>
  )
}

// Once per band the scale rules, like CrossHatches; pointer-events disabled so
// the canvas underneath still gets mouse events.
const ScoreRules = observer(function ScoreRules({
  marks,
  width,
  height,
  bandTops,
}: {
  marks: ScoreRuleMark[]
  width: number
  height: number
  bandTops: number[]
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
        width,
      }}
    >
      {bandTops.map(top => (
        <ScoreRuleLines key={top} marks={marks} width={width} offsetY={top} />
      ))}
    </svg>
  )
})

export default ScoreRules

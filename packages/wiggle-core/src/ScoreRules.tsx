import type { ScoreRuleMark } from './scoreRules.ts'

const DEFAULT_RULE_COLOR = 'rgb(120,120,120)'

// Bare marks, no wrapping <svg>, so the on-screen overlay and the SVG export
// draw the same elements from the same y. Same split as CrossHatchLines.
export function ScoreRuleLines({
  marks,
  width,
  offsetY = 0,
}: {
  marks: ScoreRuleMark[]
  width: number
  offsetY?: number
}) {
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
                y={lineY - 2}
                textAnchor="end"
                fontSize={10}
                fill={stroke}
                fillOpacity={0.9}
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

// Pointer-events disabled so the canvas underneath still gets mouse events,
// matching CrossHatches.
export default function ScoreRules({
  marks,
  width,
  height,
}: {
  marks: ScoreRuleMark[]
  width: number
  height: number
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
      <ScoreRuleLines marks={marks} width={width} />
    </svg>
  )
}

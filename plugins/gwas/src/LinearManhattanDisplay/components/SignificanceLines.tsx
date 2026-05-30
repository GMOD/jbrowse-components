import { observer } from 'mobx-react'

import type { SignificanceLine } from '../significanceLines.ts'

// Dashed horizontal reference lines at the GWAS significance cutoffs, labelled
// at the right edge. Pointer-events disabled so the canvas still gets mouse
// events for hit-testing.
const SignificanceLines = observer(function SignificanceLines({
  lines,
  width,
  height,
}: {
  lines: SignificanceLine[]
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
        width,
        height,
      }}
    >
      {lines.map(line => (
        <g key={line.label}>
          <line
            x1={0}
            x2={width}
            y1={line.y}
            y2={line.y}
            stroke={line.color}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={width - 4}
            y={line.y - 3}
            textAnchor="end"
            fontSize={9}
            fontFamily="sans-serif"
            fill={line.color}
          >
            {line.label}
          </text>
        </g>
      ))}
    </svg>
  )
})

export default SignificanceLines

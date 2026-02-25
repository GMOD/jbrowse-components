import { measureText } from '@jbrowse/core/util'

import { getRowTop } from './wiggleComponentUtils.ts'

export default function MultiRowLabels({
  sources,
  rowHeight,
  labelOffset,
}: {
  sources: { name: string; labelColor?: string }[]
  rowHeight: number
  labelOffset: number
}) {
  const labelWidth =
    Math.max(...sources.map(s => measureText(s.name, 10))) + 10
  return (
    <g transform={`translate(${labelOffset} 0)`}>
      {sources.map((source, idx) => {
        const y = getRowTop(idx, rowHeight)
        const boxHeight = Math.min(20, rowHeight)
        const lc = source.labelColor
        return (
          <g key={source.name}>
            <rect
              x={0}
              y={y}
              width={labelWidth}
              height={boxHeight}
              fill={lc ?? 'rgba(255,255,255,0.8)'}
            />
            <text
              x={4}
              y={y + boxHeight / 2 + 3}
              fontSize={10}
              fill={lc ? 'white' : 'black'}
            >
              {source.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

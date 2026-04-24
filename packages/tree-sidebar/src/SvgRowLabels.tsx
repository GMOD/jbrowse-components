import { measureText } from '@jbrowse/core/util'

export function SvgRowLabels({
  sources,
  rowHeight,
  labelOffset,
  scrollTop = 0,
  availableHeight,
}: {
  sources: { name: string; labelColor?: string }[]
  rowHeight: number
  labelOffset: number
  scrollTop?: number
  availableHeight?: number
}) {
  const fontSize = Math.min(rowHeight, 12)
  const boxHeight = Math.min(rowHeight, 20)
  const labelWidth =
    sources.reduce((m, s) => Math.max(m, measureText(s.name, fontSize)), 0) +
    10
  return (
    <g transform={`translate(${labelOffset} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * rowHeight - scrollTop
        if (
          availableHeight !== undefined &&
          (y + rowHeight < 0 || y > availableHeight)
        ) {
          return null
        }
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
              y={y + boxHeight / 2}
              fontSize={fontSize}
              dominantBaseline="central"
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

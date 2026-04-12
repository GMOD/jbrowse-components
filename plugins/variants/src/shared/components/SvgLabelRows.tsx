import { measureText } from '@jbrowse/core/util'

const SvgLabelRows = ({
  sources,
  rowHeight,
  scrollTop,
  availableHeight,
  labelOffset,
}: {
  sources: { name: string }[]
  rowHeight: number
  scrollTop: number
  availableHeight: number
  labelOffset: number
}) => {
  const svgFontSize = Math.min(rowHeight, 12)
  let maxWidth = 0
  for (const s of sources) {
    const w = measureText(s.name, svgFontSize)
    if (w > maxWidth) {
      maxWidth = w
    }
  }
  const labelWidth = maxWidth + 10

  return (
    <g transform={`translate(${labelOffset} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * rowHeight - scrollTop
        if (y + rowHeight < 0 || y > availableHeight) {
          return null
        }
        return (
          <g key={source.name}>
            <rect
              x={0}
              y={y}
              width={labelWidth}
              height={rowHeight}
              fill="rgba(255,255,255,0.8)"
            />
            <text
              x={4}
              y={y + rowHeight / 2}
              fontSize={svgFontSize}
              dominantBaseline="central"
            >
              {source.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export default SvgLabelRows

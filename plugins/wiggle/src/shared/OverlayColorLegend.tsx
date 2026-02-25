import { measureText } from '@jbrowse/core/util'

export default function OverlayColorLegend({
  sources,
  fallbackColor,
  offset = 0,
}: {
  sources: { name: string; color?: string }[]
  fallbackColor: string
  offset?: number
}) {
  const labelWidth =
    Math.max(...sources.map(s => measureText(s.name, 10))) + 10
  return (
    <g transform={`translate(${offset} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * 14
        return (
          <g key={source.name}>
            <rect
              x={0}
              y={y}
              width={labelWidth + 14}
              height={14}
              fill="rgba(255,255,255,0.8)"
            />
            <rect
              x={2}
              y={y + 2}
              width={10}
              height={10}
              fill={source.color ?? fallbackColor}
            />
            <text x={16} y={y + 11} fontSize={10}>
              {source.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

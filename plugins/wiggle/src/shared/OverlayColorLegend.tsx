import { measureText } from '@jbrowse/core/util'

export default function OverlayColorLegend({
  sources,
  fallbackColor,
  canvasWidth,
}: {
  sources: { name: string; color?: string; labelColor?: string }[]
  fallbackColor: string
  canvasWidth: number
}) {
  const labelWidth =
    Math.max(...sources.map(s => measureText(s.name, 10))) + 10
  const totalWidth = labelWidth + 14
  const x = canvasWidth - totalWidth - 4
  return (
    <g transform={`translate(${x} 0)`}>
      {sources.map((source, idx) => {
        const y = idx * 14
        return (
          <g key={source.name}>
            <rect
              x={0}
              y={y}
              width={totalWidth}
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
            <text
              x={16}
              y={y + 11}
              fontSize={10}
              fill={source.labelColor ?? 'black'}
            >
              {source.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

import { measureText } from '@jbrowse/core/util'

export default function OverlayColorLegend({
  sources,
  fallbackColor,
  canvasWidth,
}: {
  sources: {
    name: string
    label?: string
    color?: string
    labelColor?: string
  }[]
  fallbackColor: string
  canvasWidth: number
}) {
  // `label` from the adapter config is the displayed string when present;
  // `name` stays the row identity.
  const display = sources.map(s => s.label ?? s.name)
  let labelWidth = 0
  for (const d of display) {
    const w = measureText(d, 10)
    if (w > labelWidth) {
      labelWidth = w
    }
  }
  labelWidth += 10
  const totalWidth = labelWidth + 14
  const x = Math.max(0, canvasWidth - totalWidth - 4)
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
              {display[idx]}
            </text>
          </g>
        )
      })}
    </g>
  )
}

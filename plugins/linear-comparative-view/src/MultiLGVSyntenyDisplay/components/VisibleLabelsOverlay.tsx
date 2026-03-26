import type { VisibleLabel } from './computeVisibleLabels.ts'

const BASE_CONTRAST: Record<string, string> = {
  A: '#fff',
  C: '#fff',
  G: '#000',
  T: '#fff',
}

export default function VisibleLabelsOverlay({
  labels,
  width,
  height,
}: {
  labels: VisibleLabel[]
  width: number
  height: number
}) {
  if (labels.length === 0) {
    return null
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {labels.map((label, i) => {
        let fillColor = '#fff'
        if (label.type === 'mismatch' && label.text.length === 1) {
          fillColor = BASE_CONTRAST[label.text] ?? '#fff'
        }
        return (
          <text
            key={`${label.type}-${i}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={label.fontSize}
            fontFamily="monospace"
            fontWeight="bold"
            fill={fillColor}
          >
            {label.text}
          </text>
        )
      })}
    </svg>
  )
}

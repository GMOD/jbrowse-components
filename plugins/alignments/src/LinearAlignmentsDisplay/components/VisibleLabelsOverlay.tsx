import { observer } from 'mobx-react'

import type { VisibleLabel } from './computeVisibleLabels.ts'

interface VisibleLabelsOverlayProps {
  labels: VisibleLabel[]
  width: number | undefined
  height: number
  contrastMap: Record<string, string>
}

const interbaseColorMap: Record<string, string> = {
  insertion: '#800080',
  softclip: '#0000ff',
  hardclip: '#ff0000',
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  contrastMap,
}: VisibleLabelsOverlayProps) {
  if (labels.length === 0) {
    return null
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: width ?? '100%',
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {labels.map((label, i) => {
        const isSmallInterbase =
          (label.type === 'insertion' ||
            label.type === 'softclip' ||
            label.type === 'hardclip') &&
          label.text.startsWith('(')
        let fillColor = '#fff'
        if (isSmallInterbase) {
          fillColor = interbaseColorMap[label.type] ?? '#800080'
        } else if (label.type === 'mismatch') {
          fillColor = contrastMap[label.text] ?? '#fff'
        }
        return (
          <text
            key={`${label.type}-${i}`}
            x={label.x}
            y={label.y}
            textAnchor={isSmallInterbase ? 'start' : 'middle'}
            dominantBaseline="central"
            fontSize={label.type === 'mismatch' ? 9 : 10}
            fontFamily="sans-serif"
            fontWeight="bold"
            fill={fillColor}
          >
            {label.text}
          </text>
        )
      })}
    </svg>
  )
})

export default VisibleLabelsOverlay

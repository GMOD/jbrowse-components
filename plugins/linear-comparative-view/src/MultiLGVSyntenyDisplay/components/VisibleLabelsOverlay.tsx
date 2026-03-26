import { useEffect, useRef } from 'react'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, width, height)
    for (const label of labels) {
      ctx.font = `bold ${label.fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let fillColor = '#fff'
      if (label.type === 'mismatch' && label.text.length === 1) {
        fillColor = BASE_CONTRAST[label.text] ?? '#fff'
      }
      ctx.fillStyle = fillColor
      ctx.fillText(label.text, label.x, label.y)
    }
  }, [labels, width, height])

  if (labels.length === 0) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

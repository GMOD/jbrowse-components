import { useEffect, useRef } from 'react'

import { drawSyntenyLabels } from './drawSyntenyLabels.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

export default function VisibleLabelsOverlay({
  labels,
  width,
  height,
  yOffset = 0,
}: {
  labels: VisibleLabel[]
  width: number
  height: number
  yOffset?: number
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
    drawSyntenyLabels(ctx, labels, yOffset)
  }, [labels, width, height, yOffset])

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

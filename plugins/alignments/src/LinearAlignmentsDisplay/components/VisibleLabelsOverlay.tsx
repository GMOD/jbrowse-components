import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { drawAlignmentLabels } from './drawAlignmentLabels.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

interface VisibleLabelsOverlayProps {
  labels: VisibleLabel[]
  width: number | undefined
  height: number
  contrastMap: Record<string, string>
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  contrastMap,
}: VisibleLabelsOverlayProps) {
  const theme = useTheme()
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
    const dpr = window.devicePixelRatio
    const w = width ?? 0
    canvas.width = w * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, height)
    drawAlignmentLabels(ctx, labels, contrastMap, theme)
  }, [labels, width, height, contrastMap, theme])

  if (labels.length === 0) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  )
})

export default VisibleLabelsOverlay

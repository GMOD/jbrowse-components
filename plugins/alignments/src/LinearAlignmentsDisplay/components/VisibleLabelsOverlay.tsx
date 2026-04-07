import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

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
    const dpr = window.devicePixelRatio ?? 1
    const w = width ?? 0
    canvas.width = w * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, height)
    for (const label of labels) {
      const isSmallInterbase =
        (label.type === 'insertion' ||
          label.type === 'softclip' ||
          label.type === 'hardclip') &&
        label.text.startsWith('(')

      let fillColor = theme.palette.common.white
      if (isSmallInterbase) {
        if (label.type === 'insertion') {
          fillColor = theme.palette.insertion
        } else if (label.type === 'softclip') {
          fillColor = theme.palette.softclip
        } else if (label.type === 'hardclip') {
          fillColor = theme.palette.hardclip
        }
      } else if (label.type === 'mismatch') {
        fillColor = contrastMap[label.text] ?? theme.palette.common.white
      }

      ctx.font = `bold ${label.fontSize}px sans-serif`
      ctx.textAlign = isSmallInterbase ? 'left' : 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = fillColor
      ctx.fillText(label.text, label.x, label.y)
    }
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

import React, { useEffect, useMemo, useRef } from 'react'

import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { FONT_CONFIG } from '../../LinearMafRenderer/rendering/types.ts'
import { getContrastBaseMap } from '../../LinearMafRenderer/util.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

interface Props {
  labels: VisibleLabel[]
  width: number
  height: number
  mismatchRendering: boolean
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  mismatchRendering,
}: Props) {
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const contrastForBase = useMemo(() => getContrastBaseMap(theme), [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)
      ctx.font = FONT_CONFIG
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      for (const label of labels) {
        ctx.fillStyle = mismatchRendering
          ? (contrastForBase[label.lowerBase] ?? 'black')
          : 'black'
        ctx.fillText(label.text, label.x, label.y)
      }
    }
  }, [labels, width, height, mismatchRendering, contrastForBase])

  return labels.length === 0 ? null : (
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

import React, { useEffect, useMemo, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/core/gpu/canvas2dUtils'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { drawMafLabels } from '../../LinearMafRenderer/rendering/labels.ts'
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
    const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
    if (ctx) {
      drawMafLabels(ctx, labels, contrastForBase, mismatchRendering)
    }
  }, [labels, width, height, mismatchRendering, contrastForBase])

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

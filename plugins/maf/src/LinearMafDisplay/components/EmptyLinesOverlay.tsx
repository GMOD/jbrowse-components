import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/core/gpu/canvas2dUtils'
import { observer } from 'mobx-react'

import { drawMafEmptyLines } from '../../LinearMafRenderer/rendering/emptyLines.ts'

import type { EmptyLineSegment } from './computeVisibleEmptyLines.ts'
import type { MafColorPalette } from '../../LinearMafRenderer/util.ts'

const EmptyLinesOverlay = observer(function EmptyLinesOverlay({
  segments,
  width,
  height,
  palette,
}: {
  segments: EmptyLineSegment[]
  width: number
  height: number
  palette: MafColorPalette
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, width, height)
    if (ctx) {
      drawMafEmptyLines(ctx, segments, palette)
    }
  }, [segments, width, height, palette])

  if (segments.length === 0) {
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

export default EmptyLinesOverlay

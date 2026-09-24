import { useEffect, useRef } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { virtualRange } from '@jbrowse/core/util/virtualRange'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'

import { FONT, ROW_HEIGHT } from './constants.ts'

import type { Sample } from '../types.ts'

interface LabelsCanvasProps {
  samples: Sample[]
  labelWidth: number
  scrollTop: number
  containerHeight: number
}

const OVERSCAN = 5

export default function LabelsCanvas({
  samples,
  labelWidth,
  scrollTop,
  containerHeight,
}: LabelsCanvasProps) {
  const palette = usePalette()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { start: startRow, end: endRow } = virtualRange({
    scroll: scrollTop,
    cellSize: ROW_HEIGHT,
    viewport: containerHeight,
    overscan: OVERSCAN,
    total: samples.length,
  })
  const canvasHeight = (endRow - startRow) * ROW_HEIGHT
  const offsetY = scrollTop - startRow * ROW_HEIGHT

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, labelWidth, canvasHeight)
    if (ctx && canvasHeight > 0 && labelWidth > 0) {
      ctx.fillStyle = palette.background.paper
      ctx.fillRect(0, 0, labelWidth, canvasHeight)
      ctx.font = FONT
      ctx.textBaseline = 'top'
      ctx.fillStyle = palette.text.secondary
      for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
        ctx.fillText(
          samples[rowIdx]!.label,
          2,
          (rowIdx - startRow) * ROW_HEIGHT + 2,
        )
      }
    }
  }, [samples, labelWidth, canvasHeight, startRow, endRow, palette])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        width: labelWidth,
        height: canvasHeight,
        transform: `translateY(${-offsetY}px)`,
      }}
    />
  )
}

import React, { useCallback, useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'

import { CHAR_WIDTH, ROW_HEIGHT } from './constants.ts'
import { drawSequenceGrid } from './drawSequenceGrid.ts'
import { virtualRange } from './virtualRange.ts'

import type { Sample } from '../types.ts'

interface SequenceCanvasProps {
  samples: Sample[]
  sequences: string[]
  colorBackground: boolean
  scrollTop: number
  scrollLeft: number
  containerHeight: number
  containerWidth: number
  onHover: (
    col: number | undefined,
    row: number | undefined,
    clientX: number,
    clientY: number,
  ) => void
  onLeave: () => void
}

const OVERSCAN_ROWS = 5
const OVERSCAN_COLS = 10

export default function SequenceCanvas({
  samples,
  sequences,
  colorBackground,
  scrollTop,
  scrollLeft,
  containerHeight,
  containerWidth,
  onHover,
  onLeave,
}: SequenceCanvasProps) {
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const seqLength = sequences[0]?.length ?? 0

  const { start: startRow, end: endRow } = virtualRange({
    scroll: scrollTop,
    cellSize: ROW_HEIGHT,
    viewport: containerHeight,
    overscan: OVERSCAN_ROWS,
    total: samples.length,
  })
  const { start: startCol, end: endCol } = virtualRange({
    scroll: scrollLeft,
    cellSize: CHAR_WIDTH,
    viewport: containerWidth,
    overscan: OVERSCAN_COLS,
    total: seqLength,
  })
  const canvasHeight = (endRow - startRow) * ROW_HEIGHT
  const canvasWidth = (endCol - startCol) * CHAR_WIDTH

  useEffect(() => {
    const ctx = getPreparedCanvas2D(canvasRef.current, canvasWidth, canvasHeight)
    if (ctx && canvasWidth > 0 && canvasHeight > 0) {
      drawSequenceGrid({
        ctx,
        sequences,
        startRow,
        endRow,
        startCol,
        endCol,
        width: canvasWidth,
        height: canvasHeight,
        colorBackground,
        theme,
      })
    }
  }, [
    sequences,
    canvasWidth,
    canvasHeight,
    startRow,
    endRow,
    startCol,
    endCol,
    colorBackground,
    theme,
  ])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const col = startCol + Math.floor((e.clientX - rect.left) / CHAR_WIDTH)
        const row = startRow + Math.floor((e.clientY - rect.top) / ROW_HEIGHT)
        onHover(
          col >= 0 && col < seqLength ? col : undefined,
          row >= 0 && row < samples.length ? row : undefined,
          e.clientX,
          e.clientY,
        )
      }
    },
    [seqLength, samples.length, startRow, startCol, onHover],
  )

  return (
    <canvas
      ref={canvasRef}
      // Positioned in the same content space as the hover-highlight overlay so
      // the two scroll natively together. A `sticky` + `transform` pin updates
      // on every native scroll frame, but the transform only catches up when
      // React commits the scroll state — that lag made the highlight drift off
      // to the side of the hovered base during manual horizontal scrolling.
      style={{
        display: 'block',
        position: 'absolute',
        top: startRow * ROW_HEIGHT,
        left: startCol * CHAR_WIDTH,
        width: canvasWidth,
        height: canvasHeight,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={onLeave}
    />
  )
}

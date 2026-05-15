import React, { useCallback, useEffect, useRef } from 'react'

import { alpha, useTheme } from '@mui/material'

import { getBaseColor, getContrastText } from './baseColors.ts'
import { CHAR_WIDTH, FONT, ROW_HEIGHT } from './constants.ts'

import type { Sample } from '../types.ts'

interface SequenceCanvasProps {
  samples: Sample[]
  sequences: string[]
  colorBackground: boolean
  hoveredCol?: number
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
  hoveredCol,
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

  // Vertical virtualization
  const startRow = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  )
  const visibleRows =
    Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2
  const endRow = Math.min(samples.length, startRow + visibleRows)
  const renderedRowCount = endRow - startRow
  const canvasHeight = renderedRowCount * ROW_HEIGHT
  const offsetY = scrollTop - startRow * ROW_HEIGHT

  // Horizontal virtualization
  const startCol = Math.max(
    0,
    Math.floor(scrollLeft / CHAR_WIDTH) - OVERSCAN_COLS,
  )
  const visibleCols = Math.ceil(containerWidth / CHAR_WIDTH) + OVERSCAN_COLS * 2
  const endCol = Math.min(seqLength, startCol + visibleCols)
  const renderedColCount = endCol - startCol
  const canvasWidth = renderedColCount * CHAR_WIDTH
  const offsetX = scrollLeft - startCol * CHAR_WIDTH

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasWidth <= 0 || canvasHeight <= 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasWidth * dpr
    canvas.height = canvasHeight * dpr
    canvas.style.width = `${canvasWidth}px`
    canvas.style.height = `${canvasHeight}px`
    ctx.scale(dpr, dpr)

    ctx.fillStyle = theme.palette.background.paper
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.font = FONT
    ctx.textBaseline = 'top'

    for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
      const seq = sequences[rowIdx] || ''
      const y = (rowIdx - startRow) * ROW_HEIGHT

      for (let colIdx = startCol; colIdx < endCol; colIdx++) {
        const char = seq[colIdx]
        if (!char) {
          continue
        }
        const x = (colIdx - startCol) * CHAR_WIDTH

        if (colorBackground && char !== '-' && char !== '.') {
          ctx.fillStyle = getBaseColor(char, theme)
          ctx.fillRect(x, y, CHAR_WIDTH, ROW_HEIGHT)
        }

        if (colIdx === hoveredCol) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          const highlightColor = theme.palette.highlight?.main ?? '#FFB11D'
          ctx.fillStyle = alpha(highlightColor, 0.5)
          ctx.fillRect(x, y, CHAR_WIDTH, ROW_HEIGHT)
        }

        if (char === '-') {
          ctx.fillStyle = theme.palette.grey[400]
        } else if (char === '.') {
          ctx.fillStyle = theme.palette.grey[500]
        } else if (colorBackground) {
          ctx.fillStyle = getContrastText(char, theme)
        } else {
          ctx.fillStyle = getBaseColor(char, theme)
        }
        ctx.fillText(char, x + 2, y + 2)
      }
    }
  }, [
    samples,
    sequences,
    canvasWidth,
    canvasHeight,
    startRow,
    endRow,
    startCol,
    endCol,
    hoveredCol,
    colorBackground,
    theme,
  ])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const col = startCol + Math.floor(x / CHAR_WIDTH)
      const row = startRow + Math.floor(y / ROW_HEIGHT)

      const validCol = col >= 0 && col < seqLength ? col : undefined
      const validRow = row >= 0 && row < samples.length ? row : undefined

      onHover(validCol, validRow, e.clientX, e.clientY)
    },
    [seqLength, samples.length, startRow, startCol, onHover],
  )

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'sticky',
        top: 0,
        left: 0,
        transform: `translate(${-offsetX}px, ${-offsetY}px)`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={onLeave}
    />
  )
}

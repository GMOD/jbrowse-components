import React, { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'

import { FONT, ROW_HEIGHT } from './constants'

import type { Sample } from '../types'

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
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2
  const endRow = Math.min(samples.length, startRow + visibleRows)
  const renderedRowCount = endRow - startRow

  const canvasHeight = renderedRowCount * ROW_HEIGHT
  const offsetY = scrollTop - startRow * ROW_HEIGHT

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasHeight <= 0 || labelWidth <= 0) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = labelWidth * dpr
    canvas.height = canvasHeight * dpr
    canvas.style.width = `${labelWidth}px`
    canvas.style.height = `${canvasHeight}px`
    ctx.scale(dpr, dpr)

    ctx.fillStyle = theme.palette.background.paper
    ctx.fillRect(0, 0, labelWidth, canvasHeight)

    ctx.font = FONT
    ctx.textBaseline = 'top'

    for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
      const sample = samples[rowIdx]!
      const y = (rowIdx - startRow) * ROW_HEIGHT

      ctx.fillStyle = theme.palette.text.secondary
      ctx.fillText(sample.label ?? sample.id, 2, y + 2)
    }
  }, [samples, labelWidth, canvasHeight, startRow, endRow, theme])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translateY(${-offsetY}px)`,
      }}
    />
  )
}

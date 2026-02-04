import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

/**
 * Canvas-based Gridlines component
 *
 * Uses canvas for rendering to avoid React reconciliation overhead.
 * Updates are done imperatively via MobX autorun, outside React lifecycle.
 */
const Gridlines = observer(function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const theme = useTheme()

  // Get theme colors for ticks
  const majorTickColor = theme.palette.action.disabled
  const minorTickColor = theme.palette.divider

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    // Use autorun to update canvas outside React lifecycle
    const dispose = autorun(() => {
      const { dynamicBlocks, bpPerPx, width, offsetPx } = model

      if (!width) {
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }

      // Handle retina displays
      const dpr = window.devicePixelRatio || 1
      const height = canvas.parentElement?.clientHeight || 600

      // Set canvas size accounting for device pixel ratio
      const canvasWidth = width
      const canvasHeight = height

      // Reset transform before resizing
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      if (
        canvas.width !== canvasWidth * dpr ||
        canvas.height !== canvasHeight * dpr
      ) {
        canvas.width = canvasWidth * dpr
        canvas.height = canvasHeight * dpr
        canvas.style.width = `${canvasWidth}px`
        canvas.style.height = `${canvasHeight}px`
      }

      ctx.scale(dpr, dpr)

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Collect tick positions by type for batched drawing
      const majorTicks: number[] = []
      const minorTicks: number[] = []

      for (const block of dynamicBlocks) {
        if (block.type !== 'ContentBlock') {
          continue
        }

        const blockScreenX = block.offsetPx - offsetPx - offset
        const { start, end, reversed } = block
        const ticks = makeTicks(start, end, bpPerPx)

        for (const { type, base } of ticks) {
          const tickPosInBlock =
            (reversed ? end - base : base - start) / bpPerPx
          const x = tickPosInBlock + blockScreenX

          // Skip ticks outside visible area
          if (x < 0 || x > canvasWidth) {
            continue
          }

          if (type === 'major' || type === 'labeledMajor') {
            majorTicks.push(Math.round(x) + 0.5)
          } else {
            minorTicks.push(Math.round(x) + 0.5)
          }
        }
      }

      // Draw all minor ticks in one batch
      if (minorTicks.length > 0) {
        ctx.strokeStyle = minorTickColor
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const x of minorTicks) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvasHeight)
        }
        ctx.stroke()
      }

      // Draw all major ticks in one batch
      if (majorTicks.length > 0) {
        ctx.strokeStyle = majorTickColor
        ctx.lineWidth = 1
        ctx.beginPath()
        for (const x of majorTicks) {
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvasHeight)
        }
        ctx.stroke()
      }
    })

    return () => {
      dispose()
    }
  }, [model, offset, majorTickColor, minorTickColor])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
})

export default Gridlines

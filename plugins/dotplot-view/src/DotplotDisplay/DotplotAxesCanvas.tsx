import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../DotplotView/model.ts'
import type { DotplotDisplayModel } from './stateModelFactory.tsx'

/**
 * Renders axes labels and gridlines for the dotplot
 * Uses HTML canvas for axes and optional gridlines
 */
const DotplotAxesCanvas = observer(function DotplotAxesCanvas(props: {
  model: DotplotDisplayModel
}) {
  const { model } = props
  const view = getContainingView(model) as DotplotViewModel
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const canvasWidth = view.viewWidth
  const canvasHeight = view.viewHeight
  const borderX = view.borderX
  const borderY = view.borderY

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn('DotplotAxesCanvas: canvas ref is null')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.warn('DotplotAxesCanvas: could not get 2d context')
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = (canvasWidth + borderX) * dpr
    canvas.height = (canvasHeight + borderY) * dpr
    ctx.scale(dpr, dpr)

    console.log('DotplotAxesCanvas: initialized with dimensions', {
      canvasWidth,
      canvasHeight,
      borderX,
      borderY,
    })

    // Clear with light gray instead of white to see if it's showing
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, canvasWidth + borderX, canvasHeight + borderY)

    // Draw gridlines for horizontal axis
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 0.5
    const hBlocks = view.hview.staticBlocks.contentBlocks
    for (const block of hBlocks) {
      const x = borderX + block.offsetPx - view.hview.offsetPx
      if (x >= borderX && x <= canvasWidth + borderX) {
        ctx.beginPath()
        ctx.moveTo(x, borderY)
        ctx.lineTo(x, canvasHeight + borderY)
        ctx.stroke()
      }
    }

    // Draw gridlines for vertical axis
    const vBlocks = view.vview.staticBlocks.contentBlocks
    for (const block of vBlocks) {
      const y = borderY + (canvasHeight - (block.offsetPx - view.vview.offsetPx))
      if (y >= borderY && y <= canvasHeight + borderY) {
        ctx.beginPath()
        ctx.moveTo(borderX, y)
        ctx.lineTo(canvasWidth + borderX, y)
        ctx.stroke()
      }
    }

    // Draw axis labels
    ctx.fillStyle = '#000000'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    // Horizontal axis labels
    for (const block of hBlocks) {
      const x = borderX + block.offsetPx - view.hview.offsetPx
      if (x >= borderX && x <= canvasWidth + borderX) {
        ctx.fillText(block.refName, x, canvasHeight + borderY + 2)
      }
    }

    // Vertical axis labels
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const block of vBlocks) {
      const y = borderY + (canvasHeight - (block.offsetPx - view.vview.offsetPx))
      if (y >= borderY && y <= canvasHeight + borderY) {
        ctx.fillText(block.refName, borderX - 5, y)
      }
    }
  }, [canvasWidth, canvasHeight, borderX, borderY, view.hview, view.vview])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvasWidth + borderX,
        height: canvasHeight + borderY,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
})

export default DotplotAxesCanvas

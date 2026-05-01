import { useEffect, useRef } from 'react'

import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { GraphGenomeViewModel } from '../model.ts'

const PALETTE = [
  '#4393c3',
  '#d6604d',
  '#74add1',
  '#f46d43',
  '#abd9e9',
  '#e0f3f8',
  '#4dac26',
  '#b8e186',
  '#7b3294',
  '#c2a5cf',
]

const LABEL_WIDTH = 120

const LargeModeSyntenyCanvas = observer(function LargeModeSyntenyCanvas({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }
    return autorun(() => {
      const { syntenyBlocks, largeModeRegion, width, canvasHeight } = model
      if (!syntenyBlocks || !largeModeRegion) {
        return
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return
      }
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = canvasHeight * dpr
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, canvasHeight)

      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, LABEL_WIDTH, canvasHeight)

      const drawWidth = width - LABEL_WIDTH
      const refLen = largeModeRegion.end - largeModeRegion.start
      const rowCount = syntenyBlocks.length || 1
      const rowHeight = canvasHeight / rowCount

      for (let i = 0; i < syntenyBlocks.length; i++) {
        const [genome, blocks] = syntenyBlocks[i]!
        const color = PALETTE[i % PALETTE.length]!
        const y = i * rowHeight

        ctx.fillStyle = '#e8e8e8'
        ctx.fillRect(LABEL_WIDTH, y, drawWidth, rowHeight - 1)

        for (const block of blocks) {
          const x =
            LABEL_WIDTH +
            ((block.refStart - largeModeRegion.start) / refLen) * drawWidth
          const w =
            Math.max(1, ((block.refEnd - block.refStart) / refLen) * drawWidth)
          const alpha = 0.35 + 0.65 * block.identity
          ctx.globalAlpha = alpha
          ctx.fillStyle = block.strand > 0 ? color : adjustColor(color)
          ctx.fillRect(x, y + 1, w, rowHeight - 3)
        }
        ctx.globalAlpha = 1

        ctx.fillStyle = '#333'
        ctx.font = `${Math.min(12, rowHeight - 4)}px sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(genome, 4, y + rowHeight / 2, LABEL_WIDTH - 8)
      }
      ctx.restore()
    })
  }, [model])

  const { width, canvasHeight } = model
  return (
    <canvas
      ref={canvasRef}
      style={{ width, height: canvasHeight, display: 'block' }}
    />
  )
})

function adjustColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const avg = (r + g + b) / 3
  return `rgb(${Math.round(avg)},${Math.round(g * 0.6)},${Math.round(b * 1.2)})`
}

export default LargeModeSyntenyCanvas

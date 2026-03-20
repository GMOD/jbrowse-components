import { useEffect, useRef } from 'react'

import { observer } from 'mobx-react'

import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { MultiSyntenyFeature } from '../model.ts'

const SYRI_COLOR_MAP: Record<string, string> = {
  SYN: syriColors.SYN,
  INV: syriColors.INV,
  TRANS: syriColors.TRANS,
  DUP: syriColors.DUP,
}

const DEFAULT_COLOR = '#999999'

function getFeatureColor(feat: MultiSyntenyFeature) {
  if (feat.syriType) {
    return SYRI_COLOR_MAP[feat.syriType] ?? DEFAULT_COLOR
  }
  if (feat.strand === -1) {
    return '#FFA500'
  }
  return '#CCCCCC'
}

const MultiSyntenyRendering = observer(function MultiSyntenyRendering({
  genomeRows,
  displayedGenomes,
  width,
  rowHeight,
  bpPerPx,
  offsetPx,
}: {
  genomeRows: Map<string, MultiSyntenyFeature[]>
  displayedGenomes: string[]
  width: number
  rowHeight: number
  bpPerPx: number
  offsetPx: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const height = displayedGenomes.length * rowHeight

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const labelWidth = 120
    const trackLeft = labelWidth
    const trackWidth = width - labelWidth

    // Draw genome labels and features
    for (let g = 0; g < displayedGenomes.length; g++) {
      const genomeName = displayedGenomes[g]!
      const y = g * rowHeight
      const features = genomeRows.get(genomeName) ?? []

      // Background stripe
      if (g % 2 === 0) {
        ctx.fillStyle = '#f8f8f8'
        ctx.fillRect(0, y, width, rowHeight)
      }

      // Label
      ctx.fillStyle = '#333'
      ctx.font = `${Math.min(rowHeight - 4, 12)}px sans-serif`
      ctx.textBaseline = 'middle'
      const displayName = genomeName.length > 15
        ? genomeName.slice(0, 12) + '...'
        : genomeName
      ctx.fillText(displayName, 4, y + rowHeight / 2)

      // Feature blocks
      const padding = 2
      for (const feat of features) {
        const x1 = (feat.start / bpPerPx) - offsetPx + trackLeft
        const x2 = (feat.end / bpPerPx) - offsetPx + trackLeft
        const blockWidth = Math.max(x2 - x1, 1)

        if (x1 + blockWidth < trackLeft || x1 > width) {
          continue
        }

        ctx.fillStyle = getFeatureColor(feat)
        ctx.fillRect(
          Math.max(x1, trackLeft),
          y + padding,
          Math.min(blockWidth, width - Math.max(x1, trackLeft)),
          rowHeight - padding * 2,
        )
      }

      // Row separator
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }

    // Legend
    if (displayedGenomes.length > 0) {
      const legendY = 4
      const legendX = trackLeft + 4
      ctx.font = '10px sans-serif'
      ctx.textBaseline = 'top'
      let lx = legendX
      for (const [label, color] of Object.entries(SYRI_COLOR_MAP)) {
        ctx.fillStyle = color
        ctx.fillRect(lx, legendY, 10, 10)
        ctx.fillStyle = '#333'
        ctx.fillText(label, lx + 13, legendY)
        lx += ctx.measureText(label).width + 22
      }
    }
  }, [genomeRows, displayedGenomes, width, height, rowHeight, bpPerPx, offsetPx])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
      }}
    />
  )
})

export default MultiSyntenyRendering

import { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LDDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Get color for R² value using a red color scale
 * Higher R² = darker red
 */
function getColorForR2(r2: number): string {
  // Clamp to 0-1
  const val = Math.max(0, Math.min(1, r2))
  // HSL: hue=0 (red), saturation=80%, lightness varies from 95% (low LD) to 40% (high LD)
  const lightness = 95 - val * 55
  return `hsl(0, 80%, ${lightness}%)`
}

const LDCanvas = observer(function LDCanvas({
  model,
}: {
  model: LDDisplayModel
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { ldData, height, lineZoneHeight } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const { width } = view

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ldData) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const { snps, ldValues } = ldData
    const n = snps.length

    if (n === 0) {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#666'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No variants in view (try adjusting MAF filter)', width / 2, height / 2)
      return
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Calculate dimensions for the diamond/triangle display
    const matrixHeight = height - lineZoneHeight
    const padding = 10
    const availableWidth = width - 2 * padding

    // Box size based on number of SNPs
    const boxSize = Math.min(availableWidth / n, matrixHeight / (n / 2), 20)
    const boxDiag = boxSize / Math.sqrt(2)

    // Center the matrix horizontally
    const matrixWidth = n * boxSize
    const offsetX = (width - matrixWidth) / 2

    // Draw connecting lines from matrix columns to genomic positions
    ctx.strokeStyle = '#999'
    ctx.lineWidth = 0.5

    const region = view.dynamicBlocks.contentBlocks[0]
    if (region) {
      for (let i = 0; i < n; i++) {
        const snp = snps[i]!
        // Matrix column position (center of column)
        const matrixX = offsetX + i * boxSize + boxSize / 2

        // Genomic position in view coordinates
        const genomicX = (snp.start - region.start) / view.bpPerPx + region.offsetPx

        ctx.beginPath()
        ctx.moveTo(matrixX, lineZoneHeight)
        ctx.lineTo(genomicX, 0)
        ctx.stroke()
      }
    }

    // Draw the LD matrix as rotated squares (diamond orientation)
    ctx.save()
    ctx.translate(offsetX + matrixWidth / 2, lineZoneHeight)
    ctx.rotate(-Math.PI / 4)

    let ldIdx = 0
    for (let i = 1; i < n; i++) {
      for (let j = 0; j < i; j++) {
        const r2 = ldValues[ldIdx++] ?? 0
        ctx.fillStyle = getColorForR2(r2)
        ctx.fillRect(j * boxDiag, (i - 1) * boxDiag, boxDiag, boxDiag)
      }
    }

    ctx.restore()
  }, [ldData, width, height, lineZoneHeight, view])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  )
})

const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: LDDisplayModel
}) {
  const { height, error } = model

  if (error) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'red' }}>Error: {error.message}</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height }}>
      <LDCanvas model={model} />
    </div>
  )
})

export default LDDisplayComponent

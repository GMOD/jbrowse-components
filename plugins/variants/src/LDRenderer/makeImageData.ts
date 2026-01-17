import Flatbush from '@jbrowse/core/util/flatbush'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import { scaleSequential } from '@mui/x-charts-vendor/d3-scale'

import type { LDMatrixResult, LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { LDFlatbushItem } from './types.ts'
import type { Region, StopToken } from '@jbrowse/core/util'

export interface MakeImageDataResult {
  flatbush: ArrayBufferLike
  items: LDFlatbushItem[]
  maxScore: number
  w: number
}

export interface MakeImageDataProps {
  ldData: LDMatrixResult
  regions: Region[]
  bpPerPx: number
  stopToken?: StopToken
  yScalar: number
  colorScheme?: string
}

// Color schemes for different LD metrics
const colorSchemes = {
  // Red scale for R² (traditional LD plot colors)
  r2: interpolateRgbBasis([
    'rgb(255, 255, 255)',
    'rgb(255, 224, 224)',
    'rgb(255, 192, 192)',
    'rgb(255, 128, 128)',
    'rgb(255, 64, 64)',
    'rgb(255, 0, 0)',
    'rgb(208, 0, 0)',
    'rgb(160, 0, 0)',
  ]),
  // Blue scale for D'
  dprime: interpolateRgbBasis([
    'rgb(255, 255, 255)',
    'rgb(224, 224, 255)',
    'rgb(192, 192, 255)',
    'rgb(128, 128, 255)',
    'rgb(64, 64, 255)',
    'rgb(0, 0, 255)',
    'rgb(0, 0, 208)',
    'rgb(0, 0, 160)',
  ]),
}

export function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: MakeImageDataProps,
): MakeImageDataResult | undefined {
  const { ldData, regions, bpPerPx, stopToken, yScalar } = props

  const lastCheck = createStopTokenChecker(stopToken)
  const { snps, ldValues, metric } = ldData
  const n = snps.length

  if (n === 0) {
    return undefined
  }

  checkStopToken(stopToken)

  // Get the region for coordinate calculations
  const region = regions[0]
  if (!region) {
    return undefined
  }

  // Select color scheme based on metric
  const colorInterpolator = metric === 'dprime' ? colorSchemes.dprime : colorSchemes.r2
  const scale = scaleSequential(colorInterpolator).domain([0, 1])

  // Calculate uniform cell width based on view width and number of SNPs
  // The rotated matrix diagonal should span the view width
  const viewWidthPx = (region.end - region.start) / bpPerPx
  // After 45° rotation, n cells of width w have diagonal span of n * w * sqrt(2)
  // We want this to equal viewWidthPx, so: w = viewWidthPx / (n * sqrt(2))
  const w = viewWidthPx / (n * Math.sqrt(2))

  // Apply yScalar for height adjustment (like HiC)
  if (yScalar) {
    ctx.scale(1, yScalar)
  }
  ctx.save()

  // Just rotate, like HiC does
  ctx.rotate(-Math.PI / 4)

  // Build Flatbush index and items array
  const coords: number[] = []
  const items: LDFlatbushItem[] = []

  // Draw the lower triangular matrix with uniform cell sizes
  // ldValues is stored as: [ld(1,0), ld(2,0), ld(2,1), ld(3,0), ld(3,1), ld(3,2), ...]
  let ldIdx = 0

  // Use index-based positioning for uniform squares
  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const ldVal = ldValues[ldIdx] ?? 0

      // Color based on LD value
      ctx.fillStyle = scale(ldVal)

      // Use indices directly for uniform cell positioning
      const x = j * w
      const y = i * w

      ctx.fillRect(x, y, w, w)

      // Store for Flatbush (in unrotated coordinates)
      coords.push(x, y, x + w, y + w)
      items.push({
        i,
        j,
        ldValue: ldVal,
        snp1: snps[i]!,
        snp2: snps[j]!,
      })

      ldIdx++
      checkStopToken2(lastCheck)
    }
  }

  ctx.restore()

  // Build Flatbush spatial index
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let k = 0; k < coords.length; k += 4) {
      flatbush.add(coords[k]!, coords[k + 1]!, coords[k + 2]!, coords[k + 3]!)
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
    maxScore: 1, // LD values are always 0-1
    w,
  }
}

/**
 * Draw connecting lines from matrix column positions to genomic coordinates.
 * The matrix uses uniform cell widths based on indices, so we need to map
 * each SNP's matrix column position to its actual genomic position.
 */
export function drawConnectingLines(
  ctx: CanvasRenderingContext2D,
  props: {
    snps: LDMatrixResult['snps']
    region: Region
    bpPerPx: number
    lineZoneHeight: number
    viewWidthPx: number
  },
) {
  const { snps, region, bpPerPx, lineZoneHeight, viewWidthPx } = props
  const n = snps.length

  if (n === 0) {
    return
  }

  // Same cell width calculation as in makeImageData
  const w = viewWidthPx / (n * Math.sqrt(2))

  // After rotation, the matrix diagonal spans the view width
  // Each SNP column i has its top point at screen x = (i + 0.5) * w * sqrt(2)
  // which simplifies to (i + 0.5) * viewWidthPx / n

  ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)'
  ctx.lineWidth = 0.5

  for (let i = 0; i < n; i++) {
    const snp = snps[i]!

    // Matrix column position (center of column at the diagonal/top edge)
    // After -45° rotation, position (i*w, i*w) maps to screen x = i*w*sqrt(2), y = 0
    // Center of cell: ((i+0.5)*w, (i+0.5)*w) -> screen x = (i+0.5)*w*sqrt(2)
    const matrixX = (i + 0.5) * w * Math.sqrt(2)

    // Genomic position in view coordinates
    const genomicX = (snp.start - region.start) / bpPerPx

    ctx.beginPath()
    ctx.moveTo(matrixX, lineZoneHeight)
    ctx.lineTo(genomicX, 0)
    ctx.stroke()
  }
}

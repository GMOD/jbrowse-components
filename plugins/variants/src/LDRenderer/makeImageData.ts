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

  // Calculate total width
  const totalWidthPx = (region.end - region.start) / bpPerPx

  // Calculate box size based on number of SNPs and available width
  // The matrix is rotated 45°, so the diagonal width is totalWidthPx
  // For n SNPs, we have n columns, each of width w
  // After rotation, the horizontal span is n * w * sqrt(2) / 2 ≈ n * w * 0.707
  const w = Math.min(totalWidthPx / n, 20)

  // Select color scheme based on metric
  const colorInterpolator = metric === 'dprime' ? colorSchemes.dprime : colorSchemes.r2
  const scale = scaleSequential(colorInterpolator).domain([0, 1])

  // Apply yScalar for height adjustment
  if (yScalar !== 1) {
    ctx.scale(1, yScalar)
  }
  ctx.save()

  // Calculate offset to center the matrix
  const matrixWidth = n * w
  const offsetX = (totalWidthPx - matrixWidth) / 2

  // Translate to center and rotate for diamond orientation
  ctx.translate(offsetX + matrixWidth / 2, 0)
  ctx.rotate(-Math.PI / 4)

  // Build Flatbush index and items array
  const coords: number[] = []
  const items: LDFlatbushItem[] = []

  // Draw the lower triangular matrix
  // ldValues is stored as: [ld(1,0), ld(2,0), ld(2,1), ld(3,0), ld(3,1), ld(3,2), ...]
  let ldIdx = 0
  const wDiag = w / Math.sqrt(2)

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const ldVal = ldValues[ldIdx] ?? 0

      // Color based on LD value
      ctx.fillStyle = scale(ldVal)

      // Position in rotated coordinate system
      const x = j * wDiag
      const y = (i - 1) * wDiag

      ctx.fillRect(x, y, wDiag, wDiag)

      // Store for Flatbush (in unrotated coordinates)
      coords.push(x, y, x + wDiag, y + wDiag)
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
    w: wDiag,
  }
}

/**
 * Draw connecting lines from matrix positions to genomic coordinates
 */
export function drawConnectingLines(
  ctx: CanvasRenderingContext2D,
  props: {
    snps: LDMatrixResult['snps']
    region: Region
    bpPerPx: number
    lineZoneHeight: number
    totalWidthPx: number
  },
) {
  const { snps, region, bpPerPx, lineZoneHeight, totalWidthPx } = props
  const n = snps.length

  if (n === 0) {
    return
  }

  const w = Math.min(totalWidthPx / n, 20)
  const matrixWidth = n * w
  const offsetX = (totalWidthPx - matrixWidth) / 2

  ctx.strokeStyle = '#999'
  ctx.lineWidth = 0.5

  for (let i = 0; i < n; i++) {
    const snp = snps[i]!
    // Matrix column position (center of column)
    const matrixX = offsetX + i * w + w / 2

    // Genomic position in view coordinates
    const genomicX = (snp.start - region.start) / bpPerPx

    ctx.beginPath()
    ctx.moveTo(matrixX, lineZoneHeight)
    ctx.lineTo(genomicX, 0)
    ctx.stroke()
  }
}

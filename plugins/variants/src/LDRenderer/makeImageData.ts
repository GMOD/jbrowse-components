import Flatbush from '@jbrowse/core/util/flatbush'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { interpolateRgbBasis } from '@mui/x-charts-vendor/d3-interpolate'
import { scaleSequential } from '@mui/x-charts-vendor/d3-scale'

import type { LDFlatbushItem } from './types.ts'
import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LastStopTokenCheck, Region } from '@jbrowse/core/util'

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
  stopTokenCheck?: LastStopTokenCheck
  yScalar: number
  colorScheme?: string
  useGenomicPositions?: boolean
  signedLD?: boolean
}

// Color schemes for different LD metrics
const colorSchemes = {
  // Red scale for R² (traditional LD plot colors) - 0 to 1
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
  // Blue scale for D' - 0 to 1
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
  // Diverging scale for signed R (correlation) - -1 to 1
  // Blue (negative) -> White (zero) -> Red (positive)
  rSigned: interpolateRgbBasis([
    'rgb(0, 0, 160)',
    'rgb(0, 0, 208)',
    'rgb(0, 0, 255)',
    'rgb(64, 64, 255)',
    'rgb(128, 128, 255)',
    'rgb(192, 192, 255)',
    'rgb(224, 224, 255)',
    'rgb(255, 255, 255)',
    'rgb(255, 224, 224)',
    'rgb(255, 192, 192)',
    'rgb(255, 128, 128)',
    'rgb(255, 64, 64)',
    'rgb(255, 0, 0)',
    'rgb(208, 0, 0)',
    'rgb(160, 0, 0)',
  ]),
  // Diverging scale for signed D' - -1 to 1
  // Green (negative) -> White (zero) -> Blue (positive)
  dprimeSigned: interpolateRgbBasis([
    'rgb(0, 100, 0)',
    'rgb(0, 128, 0)',
    'rgb(0, 160, 0)',
    'rgb(64, 192, 64)',
    'rgb(128, 224, 128)',
    'rgb(192, 240, 192)',
    'rgb(224, 248, 224)',
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
  const {
    ldData,
    regions,
    bpPerPx,
    stopTokenCheck,
    yScalar,
    useGenomicPositions = false,
    signedLD = false,
  } = props

  const { snps, ldValues, metric } = ldData
  const n = snps.length

  if (n === 0) {
    return undefined
  }

  checkStopToken2(stopTokenCheck)

  // Get the region for coordinate calculations
  const region = regions[0]
  if (!region) {
    return undefined
  }

  // Select color scheme based on metric and whether signed
  let colorInterpolator
  if (signedLD) {
    colorInterpolator =
      metric === 'dprime' ? colorSchemes.dprimeSigned : colorSchemes.rSigned
  } else {
    colorInterpolator =
      metric === 'dprime' ? colorSchemes.dprime : colorSchemes.r2
  }
  // Domain is -1 to 1 for signed, 0 to 1 for unsigned
  const scale = scaleSequential(colorInterpolator).domain(
    signedLD ? [-1, 1] : [0, 1],
  )

  // Calculate view width in pixels
  const viewWidthPx = (region.end - region.start) / bpPerPx
  const sqrt2 = Math.sqrt(2)

  // Calculate uniform cell width (used when useGenomicPositions is false)
  // After 45° rotation, n cells of width w have diagonal span of n * w * sqrt(2)
  // We want this to equal viewWidthPx, so: w = viewWidthPx / (n * sqrt(2))
  const uniformW = viewWidthPx / (n * sqrt2)

  // Calculate genomic boundaries for each SNP (used when useGenomicPositions is true)
  // We use midpoints between adjacent SNPs so each SNP's cell extends halfway
  // to its neighbors, preventing extremely large cells when SNPs are far apart
  // We divide by sqrt(2) because the canvas is rotated 45 degrees
  const boundaries: number[] = []
  if (useGenomicPositions) {
    for (let i = 0; i < n; i++) {
      const snpPos = snps[i]!.start
      const prevPos = i > 0 ? snps[i - 1]!.start : region.start
      // Boundary is midpoint between this SNP and the previous one
      const boundaryPos = (prevPos + snpPos) / 2
      const pixelPos = (boundaryPos - region.start) / bpPerPx / sqrt2
      boundaries.push(pixelPos)
    }
    // Final boundary: small fixed offset past the last SNP
    const lastSnpPos = snps[n - 1]!.start
    const finalBoundary = lastSnpPos + 50 * bpPerPx
    boundaries.push((finalBoundary - region.start) / bpPerPx / sqrt2)
  }

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

  // Draw the lower triangular matrix
  // ldValues is stored as: [ld(1,0), ld(2,0), ld(2,1), ld(3,0), ld(3,1), ld(3,2), ...]
  let ldIdx = 0

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const ldVal = ldValues[ldIdx] ?? 0

      // Color based on LD value
      ctx.fillStyle = scale(ldVal)

      let x: number
      let y: number
      let cellW: number
      let cellH: number

      if (useGenomicPositions) {
        // Use genomic positions for cell boundaries
        x = boundaries[j]!
        y = boundaries[i]!
        cellW = boundaries[j + 1]! - x
        cellH = boundaries[i + 1]! - y
      } else {
        // Use uniform cell positioning
        x = j * uniformW
        y = i * uniformW
        cellW = uniformW
        cellH = uniformW
      }

      ctx.fillRect(x, y, cellW, cellH)

      // Store for Flatbush (in unrotated coordinates)
      coords.push(x, y, x + cellW, y + cellH)
      items.push({
        i,
        j,
        ldValue: ldVal,
        snp1: snps[i]!,
        snp2: snps[j]!,
      })

      ldIdx++
      checkStopToken2(stopTokenCheck)
    }
  }

  ctx.restore()

  // Build Flatbush spatial index
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let k = 0; k < coords.length; k += 4) {
      flatbush.add(coords[k]!, coords[k + 1]!, coords[k + 2], coords[k + 3])
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
    maxScore: signedLD ? 1 : 1, // LD values are -1 to 1 (signed) or 0 to 1 (unsigned)
    w: uniformW, // Return uniform width for backward compatibility
  }
}

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/alignments-core'
import { category10 } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  colorSchemes,
  hashString,
  syriColors,
} from '../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { SyriType } from '@jbrowse/plugin-comparative-adapters'

function toRelativeFloat32(
  values: Float64Array,
  count: number,
  refOffset: number,
) {
  const result = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    result[i] = values[i]! - refOffset
  }
  return result
}

const category10Packed = category10.map(hex => cssColorToABGR(hex))

// Pack normalized [0,1] RGBA into unsigned uint32 in ABGR byte order (R in
// bits 0-7) to match GPU shader expectations. >>> 0 forces unsigned int32.
function packRGBA(r: number, g: number, b: number, a: number) {
  return (
    ((Math.round(a * 255) << 24) |
      (Math.round(b * 255) << 16) |
      (Math.round(g * 255) << 8) |
      Math.round(r * 255)) >>>
    0
  )
}

const STRAND_POS = packRGBA(1, 0, 0, 1)
const STRAND_NEG = packRGBA(0, 0, 1, 1)
const DEFAULT_COLOR = packRGBA(1, 0, 0, 1)

const syriColorMap: Record<SyriType, number> = {
  SYN: cssColorToABGR(syriColors.SYN),
  INV: cssColorToABGR(syriColors.INV),
  TRANS: cssColorToABGR(syriColors.TRANS),
  DUP: cssColorToABGR(syriColors.DUP),
}

function createColorFunction(
  colorBy: string,
  syriTypes?: SyriType[],
): (strand: number, refName: string, index: number) => number {
  if (colorBy === 'syri' && syriTypes) {
    return (_strand: number, _refName: string, index: number) =>
      syriColorMap[syriTypes[index]!]
  }

  if (colorBy === 'strand') {
    return (strand: number) => (strand === -1 ? STRAND_NEG : STRAND_POS)
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, number>()
    return (_strand: number, refName: string) => {
      let c = colorCache.get(refName)
      if (c === undefined) {
        const hash = hashString(refName)
        c = category10Packed[hash % category10Packed.length]!
        colorCache.set(refName, c)
      }
      return c
    }
  }

  return () => DEFAULT_COLOR
}

function buildIndelColors(colorBy: string) {
  const scheme =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
  const cigarColors = scheme.cigarColors
  const indelColors: Partial<Record<number, number>> = {}
  for (const [op, key] of [
    [CIGAR_I, 'I'],
    [CIGAR_D, 'D'],
    [CIGAR_N, 'N'],
  ] as const) {
    const color = cigarColors[key as keyof typeof cigarColors]
    if (color) {
      indelColors[op] = cssColorToABGR(color)
    }
  }
  return indelColors
}

function getCigarColorByOp(
  op: number,
  indelColors: Partial<Record<number, number>>,
  colorFn: (strand: number, refName: string, index: number) => number,
  strand: number,
  refName: string,
  index: number,
) {
  return indelColors[op] ?? colorFn(strand, refName, index)
}

function estimateInstanceCount(
  featureCount: number,
  parsedCigars: number[][],
  drawCIGAR: boolean,
  drawLocationMarkers: boolean,
) {
  let estimate = featureCount
  if (drawCIGAR) {
    for (let i = 0; i < featureCount; i++) {
      estimate += parsedCigars[i]!.length
    }
  }
  if (drawLocationMarkers) {
    estimate *= 10
  }
  return estimate
}

export interface SyntenyInstanceData {
  x1: Float32Array
  x2: Float32Array
  x3: Float32Array
  x4: Float32Array
  colors: Uint32Array
  featureIds: Float32Array
  isCurves: Float32Array
  queryTotalLengths: Float32Array
  padTops: Float32Array
  padBottoms: Float32Array
  instanceCount: number
  nonCigarInstanceCount: number
  geometryBpPerPx0: number
  geometryBpPerPx1: number
  refOffset0: number
  refOffset1: number
}

export function executeSyntenyInstanceData({
  p11_offsetPx,
  p12_offsetPx,
  p21_offsetPx,
  p22_offsetPx,
  padTop: padTopArr,
  padBottom: padBottomArr,
  strands,
  names,
  refNames,
  parsedCigars,
  starts,
  ends,
  colorBy,
  syriTypes,
  drawCurves,
  drawCIGAR,
  drawCIGARMatchesOnly,
  drawLocationMarkers,
  bpPerPxs,
  level,
  viewOffsets,
  viewWidth,
}: {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  padTop: Float64Array
  padBottom: Float64Array
  strands: Int8Array
  names: string[]
  refNames: string[]
  parsedCigars: number[][]
  starts: Float64Array
  ends: Float64Array
  colorBy: string
  syriTypes?: SyriType[]
  drawCurves: boolean
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPxs: number[]
  level: number
  viewOffsets: number[]
  viewWidth: number
}): SyntenyInstanceData {
  const colorFn = createColorFunction(colorBy, syriTypes)
  const indelColors = buildIndelColors(colorBy)
  const featureCount = p11_offsetPx.length

  const queryTotalLengths = new Map<string, number>()
  for (let i = 0; i < featureCount; i++) {
    const queryName = names[i] || `feat-${i}`
    const alignmentLength = Math.abs(ends[i]! - starts[i]!)
    const current = queryTotalLengths.get(queryName) || 0
    queryTotalLengths.set(queryName, current + alignmentLength)
  }

  // Pre-allocate buffers with estimated capacity
  let capacity = estimateInstanceCount(
    featureCount,
    parsedCigars,
    drawCIGAR,
    drawLocationMarkers,
  )

  let x1s = new Float64Array(capacity)
  let x2s = new Float64Array(capacity)
  let x3s = new Float64Array(capacity)
  let x4s = new Float64Array(capacity)
  let colorsArr = new Uint32Array(capacity)
  let featureIdsArr = new Float32Array(capacity)
  let isCurvesArr = new Float32Array(capacity)
  let queryTotalLengthArr = new Float32Array(capacity)
  let padTopsArr = new Float32Array(capacity)
  let padBottomsArr = new Float32Array(capacity)

  let idx = 0

  function ensureCapacity(needed: number) {
    if (idx + needed <= capacity) {
      return
    }
    const newCapacity = Math.max(capacity * 2, idx + needed)
    const growF32 = (old: Float32Array) => {
      const arr = new Float32Array(newCapacity)
      arr.set(old.subarray(0, idx))
      return arr
    }
    const growU32 = (old: Uint32Array) => {
      const arr = new Uint32Array(newCapacity)
      arr.set(old.subarray(0, idx))
      return arr
    }
    const growF64 = (old: Float64Array) => {
      const arr = new Float64Array(newCapacity)
      arr.set(old.subarray(0, idx))
      return arr
    }
    x1s = growF64(x1s)
    x2s = growF64(x2s)
    x3s = growF64(x3s)
    x4s = growF64(x4s)
    colorsArr = growU32(colorsArr)
    featureIdsArr = growF32(featureIdsArr)
    isCurvesArr = growF32(isCurvesArr)
    queryTotalLengthArr = growF32(queryTotalLengthArr)
    padTopsArr = growF32(padTopsArr)
    padBottomsArr = growF32(padBottomsArr)
    capacity = newCapacity
  }

  function addInstance(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number,
    color: number,
    featureId: number,
    isCurve: number,
    qtl: number,
    padTop: number,
    padBottom: number,
  ) {
    ensureCapacity(1)
    x1s[idx] = topLeft
    x2s[idx] = topRight
    x3s[idx] = bottomRight
    x4s[idx] = bottomLeft
    colorsArr[idx] = color
    featureIdsArr[idx] = featureId
    isCurvesArr[idx] = isCurve
    queryTotalLengthArr[idx] = qtl
    padTopsArr[idx] = padTop
    padBottomsArr[idx] = padBottom
    idx++
  }

  function addLocationMarkers(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number,
    featureId: number,
    isCurve: number,
    qtl: number,
    padTop: number,
    padBottom: number,
  ) {
    const width1 = Math.abs(topRight - topLeft)
    const width2 = Math.abs(bottomRight - bottomLeft)
    const averageWidth = (width1 + width2) / 2

    if (averageWidth < 30) {
      return
    }

    const targetPixelSpacing = 20
    const numMarkers = Math.max(
      2,
      Math.floor(averageWidth / targetPixelSpacing) + 1,
    )

    ensureCapacity(numMarkers)

    for (let step = 0; step < numMarkers; step++) {
      const t = step / numMarkers
      const markerTopX = topLeft + (topRight - topLeft) * t
      const markerBottomX = bottomLeft + (bottomRight - bottomLeft) * t

      const screenTopX = markerTopX - viewOff0
      const screenBottomX = markerBottomX - viewOff1
      if (
        (screenTopX < -offScreenMargin || screenTopX > offScreenMargin) &&
        (screenBottomX < -offScreenMargin || screenBottomX > offScreenMargin)
      ) {
        continue
      }

      addInstance(
        markerTopX,
        markerTopX,
        markerBottomX,
        markerBottomX,
        packRGBA(0, 0, 0, 1),
        featureId,
        isCurve,
        qtl,
        padTop,
        padBottom,
      )
    }
  }

  const viewOff0 = viewOffsets[level]!
  const viewOff1 = viewOffsets[level + 1]!
  const offScreenMargin = viewWidth + 1000
  const isCurve = drawCurves ? 1 : 0
  const fallbackBpPerPxInv0 = 1 / bpPerPxs[level]!
  const fallbackBpPerPxInv1 = 1 / bpPerPxs[level + 1]!
  const minCigarPxWidth = 4

  // First loop: emit a whole-polygon instance for every feature.
  // Features that will get CIGAR detail are emitted with alpha=0 (invisible
  // in the fill pass but still usable by the edge/outline pass).
  for (let i = 0; i < featureCount; i++) {
    const x11 = p11_offsetPx[i]!
    const x12 = p12_offsetPx[i]!
    const x21 = p21_offsetPx[i]!
    const x22 = p22_offsetPx[i]!
    const featureId = i + 1
    const queryName = names[i] || `feat-${i}`
    const qtl = queryTotalLengths.get(queryName) || 0
    const strand = strands[i]!
    const refName = refNames[i]!
    const padTop = padTopArr[i]!
    const padBottom = padBottomArr[i]!

    const cigar = parsedCigars[i]!
    let willDrawCigar = false
    if (cigar.length > 0 && drawCIGAR) {
      const featureWidth = Math.max(Math.abs(x12 - x11), Math.abs(x22 - x21))
      if (featureWidth >= minCigarPxWidth) {
        willDrawCigar = true
      }
    }

    const baseColor = colorFn(strand, refName, i)
    addInstance(
      x11,
      x12,
      x22,
      x21,
      willDrawCigar ? baseColor & 0x00ffffff : baseColor,
      featureId,
      isCurve,
      qtl,
      padTop,
      padBottom,
    )

    if (!willDrawCigar && drawLocationMarkers) {
      addLocationMarkers(
        x11,
        x12,
        x22,
        x21,
        featureId,
        isCurve,
        qtl,
        padTop,
        padBottom,
      )
    }
  }

  const nonCigarInstanceCount = idx

  // Second loop: CIGAR instances (using cached parsed CIGARs)
  for (let i = 0; i < featureCount; i++) {
    const cigar = parsedCigars[i]!
    if (!(cigar.length > 0 && drawCIGAR)) {
      continue
    }

    const featureWidth = Math.max(
      Math.abs(p12_offsetPx[i]! - p11_offsetPx[i]!),
      Math.abs(p22_offsetPx[i]! - p21_offsetPx[i]!),
    )
    if (featureWidth < minCigarPxWidth) {
      continue
    }
    const x11 = p11_offsetPx[i]!
    const x12 = p12_offsetPx[i]!
    const x21 = p21_offsetPx[i]!
    const x22 = p22_offsetPx[i]!
    const strand = strands[i]!
    const refName = refNames[i]!
    const featureId = i + 1
    const queryName = names[i] || `feat-${i}`
    const qtl = queryTotalLengths.get(queryName) || 0
    const padTop = padTopArr[i]!
    const padBottom = padBottomArr[i]!

    const s1 = strand
    const k1 = s1 === -1 ? x12 : x11
    const k2 = s1 === -1 ? x11 : x12
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * s1

    let maxIndelLen = 0
    for (const packed of cigar) {
      const len = packed >>> 4
      const op = packed & 0xf
      if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
        if (len > maxIndelLen) {
          maxIndelLen = len
        }
      }
    }
    if (maxIndelLen * Math.max(fallbackBpPerPxInv0, fallbackBpPerPxInv1) < 1) {
      addInstance(
        x11,
        x12,
        x22,
        x21,
        colorFn(strand, refName, i),
        featureId,
        isCurve,
        qtl,
        padTop,
        padBottom,
      )
      if (drawLocationMarkers) {
        addLocationMarkers(
          x11,
          x12,
          x22,
          x21,
          featureId,
          isCurve,
          qtl,
          padTop,
          padBottom,
        )
      }
      continue
    }

    let cx1 = k1
    let cx2 = s1 === -1 ? x22 : x21
    let continuingFlag = false
    let px1 = 0
    let px2 = 0

    for (let j = 0; j < cigar.length; j++) {
      const packed = cigar[j]!
      const len = packed >>> 4
      const op = packed & 0xf

      if (!continuingFlag) {
        px1 = cx1
        px2 = cx2
      }

      const d1 = len * fallbackBpPerPxInv0
      const d2 = len * fallbackBpPerPxInv1

      if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if (op === CIGAR_D || op === CIGAR_N) {
        cx1 += d1 * rev1
      } else if (op === CIGAR_I) {
        cx2 += d2 * rev2
      }

      if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
        const relevantPx = op === CIGAR_I ? d2 : d1
        if (relevantPx < 1) {
          continuingFlag = true
          continue
        }
      }

      const isNotLast = j < cigar.length - 1
      if (Math.abs(cx1 - px1) <= 1 && Math.abs(cx2 - px2) <= 1 && isNotLast) {
        continuingFlag = true
      } else {
        const resolvedOp = (continuingFlag && d1 > 1) || d2 > 1 ? op : CIGAR_M
        continuingFlag = false

        const topMin = Math.min(px1, cx1) - viewOff0
        const topMax = Math.max(px1, cx1) - viewOff0
        const botMin = Math.min(px2, cx2) - viewOff1
        const botMax = Math.max(px2, cx2) - viewOff1
        const offScreen =
          (topMax < -offScreenMargin || topMin > offScreenMargin) &&
          (botMax < -offScreenMargin || botMin > offScreenMargin)

        if (!offScreen) {
          const isIndel =
            resolvedOp === CIGAR_I ||
            resolvedOp === CIGAR_D ||
            resolvedOp === CIGAR_N
          const color =
            drawCIGARMatchesOnly && isIndel
              ? 0
              : getCigarColorByOp(
                  resolvedOp,
                  indelColors,
                  colorFn,
                  strand,
                  refName,
                  i,
                )
          addInstance(
            px1,
            cx1,
            cx2,
            px2,
            color,
            featureId,
            isCurve,
            qtl,
            padTop,
            padBottom,
          )

          if (drawLocationMarkers && !(drawCIGARMatchesOnly && isIndel)) {
            addLocationMarkers(
              px1,
              cx1,
              cx2,
              px2,
              featureId,
              isCurve,
              qtl,
              padTop,
              padBottom,
            )
          }
        }
      }
    }
  }

  const instanceCount = idx
  const refOffset0 = viewOffsets[level]!
  const refOffset1 = viewOffsets[level + 1]!

  const result = {
    x1: toRelativeFloat32(x1s, instanceCount, refOffset0),
    x2: toRelativeFloat32(x2s, instanceCount, refOffset0),
    x3: toRelativeFloat32(x3s, instanceCount, refOffset1),
    x4: toRelativeFloat32(x4s, instanceCount, refOffset1),
    colors: colorsArr.subarray(0, instanceCount),
    featureIds: featureIdsArr.subarray(0, instanceCount),
    isCurves: isCurvesArr.subarray(0, instanceCount),
    queryTotalLengths: queryTotalLengthArr.subarray(0, instanceCount),
    padTops: padTopsArr.subarray(0, instanceCount),
    padBottoms: padBottomsArr.subarray(0, instanceCount),
    instanceCount,
    nonCigarInstanceCount,
    geometryBpPerPx0: bpPerPxs[level]!,
    geometryBpPerPx1: bpPerPxs[level + 1]!,
    refOffset0,
    refOffset1,
  }

  return result
}

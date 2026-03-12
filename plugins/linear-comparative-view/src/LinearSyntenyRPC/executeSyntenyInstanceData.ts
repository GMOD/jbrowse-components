import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

import { colorSchemes } from '../LinearSyntenyDisplay/drawSyntenyUtils.ts'

const OP_M = 0
const OP_I = 1
const OP_D = 2
const OP_N = 3
const OP_EQ = 7
const OP_X = 8

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

function cssColorToNormalized(color: string): [number, number, number, number] {
  const { r, g, b, a } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255, a]
}

function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

const category10Normalized = category10.map(hex => {
  const { r, g, b } = colord(hex).toRgb()
  return [r / 255, g / 255, b / 255] as [number, number, number]
})

type RGBA = [number, number, number, number]

const STRAND_POS: RGBA = [1, 0, 0, 1]
const STRAND_NEG: RGBA = [0, 0, 1, 1]
const DEFAULT_COLOR: RGBA = [1, 0, 0, 1]

function createColorFunction(
  colorBy: string,
): (strand: number, refName: string, index: number) => RGBA {
  if (colorBy === 'strand') {
    return (strand: number) => (strand === -1 ? STRAND_NEG : STRAND_POS)
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, RGBA>()
    return (_strand: number, refName: string) => {
      let c = colorCache.get(refName)
      if (!c) {
        const hash = hashString(refName)
        const [r, g, b] =
          category10Normalized[hash % category10Normalized.length]!
        c = [r, g, b, 1]
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
  const indelColors: Partial<Record<number, RGBA>> = {}
  for (const [op, key] of [
    [OP_I, 'I'],
    [OP_D, 'D'],
    [OP_N, 'N'],
  ] as const) {
    const color = cigarColors[key as keyof typeof cigarColors]
    if (color) {
      indelColors[op] = cssColorToNormalized(color)
    }
  }
  return indelColors
}

function getCigarColorByOp(
  op: number,
  indelColors: Partial<Record<number, RGBA>>,
  colorFn: (strand: number, refName: string, index: number) => RGBA,
  strand: number,
  refName: string,
  index: number,
) {
  return indelColors[op] ?? colorFn(strand, refName, index)
}

function estimateInstanceCount(
  featureCount: number,
  cigars: string[],
  drawCIGAR: boolean,
  drawLocationMarkers: boolean,
) {
  let estimate = featureCount
  if (drawCIGAR) {
    for (let i = 0; i < featureCount; i++) {
      const cigarStr = cigars[i]!
      if (cigarStr) {
        let opCount = 0
        for (let j = 0; j < cigarStr.length; j++) {
          const c = cigarStr.charCodeAt(j)
          if (c >= 65 && c <= 90) {
            opCount++
          }
        }
        estimate += opCount
      }
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
  colors: Float32Array
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
  cigars,
  parsedCigars,
  starts,
  ends,
  colorBy,
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
  cigars: string[]
  parsedCigars: number[][]
  starts: Float64Array
  ends: Float64Array
  colorBy: string
  drawCurves: boolean
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPxs: number[]
  level: number
  viewOffsets: number[]
  viewWidth: number
}): SyntenyInstanceData {
  const colorFn = createColorFunction(colorBy)
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
    cigars,
    drawCIGAR,
    drawLocationMarkers,
  )

  let x1s = new Float64Array(capacity)
  let x2s = new Float64Array(capacity)
  let x3s = new Float64Array(capacity)
  let x4s = new Float64Array(capacity)
  let colorsArr = new Float32Array(capacity * 4)
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
    const growF32 = (old: Float32Array, perInstance: number) => {
      const arr = new Float32Array(newCapacity * perInstance)
      arr.set(old.subarray(0, idx * perInstance))
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
    colorsArr = growF32(colorsArr, 4)
    featureIdsArr = growF32(featureIdsArr, 1)
    isCurvesArr = growF32(isCurvesArr, 1)
    queryTotalLengthArr = growF32(queryTotalLengthArr, 1)
    padTopsArr = growF32(padTopsArr, 1)
    padBottomsArr = growF32(padBottomsArr, 1)
    capacity = newCapacity
  }

  function addInstance(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number,
    cr: number,
    cg: number,
    cb: number,
    ca: number,
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
    const ci = idx * 4
    colorsArr[ci] = cr
    colorsArr[ci + 1] = cg
    colorsArr[ci + 2] = cb
    colorsArr[ci + 3] = ca
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
        0,
        0,
        0,
        1,
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

    const [cr, cg, cb, ca] = colorFn(strand, refName, i)
    addInstance(
      x11,
      x12,
      x22,
      x21,
      cr,
      cg,
      cb,
      willDrawCigar ? 0 : ca,
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
      if (op === OP_D || op === OP_N || op === OP_I) {
        if (len > maxIndelLen) {
          maxIndelLen = len
        }
      }
    }
    const pxPerBp0 = fallbackBpPerPxInv0
    const pxPerBp1 = fallbackBpPerPxInv1

    if (maxIndelLen * Math.max(pxPerBp0, pxPerBp1) < 1) {
      const [cr, cg, cb, ca] = colorFn(strand, refName, i)
      addInstance(
        x11,
        x12,
        x22,
        x21,
        cr,
        cg,
        cb,
        ca,
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

      const d1 = len * pxPerBp0
      const d2 = len * pxPerBp1

      if (op === OP_M || op === OP_EQ || op === OP_X) {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if (op === OP_D || op === OP_N) {
        cx1 += d1 * rev1
      } else if (op === OP_I) {
        cx2 += d2 * rev2
      }

      if (op === OP_D || op === OP_N || op === OP_I) {
        const relevantPx = op === OP_I ? d2 : d1
        if (relevantPx < 1) {
          continuingFlag = true
          continue
        }
      }

      const isNotLast = j < cigar.length - 1
      if (Math.abs(cx1 - px1) <= 1 && Math.abs(cx2 - px2) <= 1 && isNotLast) {
        continuingFlag = true
      } else {
        const resolvedOp = (continuingFlag && d1 > 1) || d2 > 1 ? op : OP_M
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
            resolvedOp === OP_I || resolvedOp === OP_D || resolvedOp === OP_N
          const [cr, cg, cb, ca] =
            drawCIGARMatchesOnly && isIndel
              ? [0, 0, 0, 0]
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
            cr,
            cg,
            cb,
            ca,
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
    colors: colorsArr.subarray(0, instanceCount * 4),
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

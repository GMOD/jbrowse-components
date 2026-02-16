import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'
import { parseCigar } from '@jbrowse/plugin-alignments'

import { colorSchemes } from '../LinearSyntenyDisplay/drawSyntenyUtils.ts'

function splitHiLo(values: Float64Array, count: number) {
  const result = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const value = values[i]!
    const hi = Math.fround(value)
    result[i * 2] = hi
    result[i * 2 + 1] = value - hi
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

function createColorFunction(
  colorBy: string,
): (
  strand: number,
  refName: string,
  index: number,
) => [number, number, number, number] {
  if (colorBy === 'strand') {
    return (strand: number) => (strand === -1 ? [0, 0, 1, 1] : [1, 0, 0, 1])
  }

  if (colorBy === 'query') {
    const colorCache = new Map<string, [number, number, number, number]>()
    return (_strand: number, refName: string) => {
      const name = refName
      if (!colorCache.has(name)) {
        const hash = hashString(name)
        const [r, g, b] =
          category10Normalized[hash % category10Normalized.length]!
        colorCache.set(name, [r, g, b, 1])
      }
      return colorCache.get(name)!
    }
  }

  return () => [1, 0, 0, 1]
}

function getCigarColor(
  letter: string,
  colorBy: string,
  colorFn: (
    strand: number,
    refName: string,
    index: number,
  ) => [number, number, number, number],
  strand: number,
  refName: string,
  index: number,
): [number, number, number, number] {
  const isInsertionOrDeletion =
    letter === 'I' || letter === 'D' || letter === 'N'

  if (!isInsertionOrDeletion) {
    return colorFn(strand, refName, index)
  }

  const scheme =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
  const cigarColors = scheme.cigarColors
  const color = cigarColors[letter as keyof typeof cigarColors]
  if (color) {
    return cssColorToNormalized(color)
  }
  return colorFn(strand, refName, index)
}

const MAX_INSTANCE_COUNT = 500_000

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
  return Math.min(estimate, MAX_INSTANCE_COUNT * 2)
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
  starts,
  ends,
  colorBy,
  drawCurves,
  drawCIGAR,
  drawCIGARMatchesOnly,
  drawLocationMarkers,
  bpPerPxs,
  level,
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
  starts: Float64Array
  ends: Float64Array
  colorBy: string
  drawCurves: boolean
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPxs: number[]
  level: number
}): SyntenyInstanceData {
  const colorFn = createColorFunction(colorBy)
  const featureCount = p11_offsetPx.length

  const queryTotalLengths = new Map<string, number>()
  for (let i = 0; i < featureCount; i++) {
    const queryName = names[i] || `feat-${i}`
    const alignmentLength = Math.abs(ends[i]! - starts[i]!)
    const current = queryTotalLengths.get(queryName) || 0
    queryTotalLengths.set(queryName, current + alignmentLength)
  }

  // Parse CIGARs once, reuse in both loops
  const parsedCigars: string[][] = new Array(featureCount)
  for (let i = 0; i < featureCount; i++) {
    const cigarStr = cigars[i]!
    parsedCigars[i] = cigarStr ? parseCigar(cigarStr) : []
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
  let locationMarkersEnabled = drawLocationMarkers

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

    const lineHalfWidth = 0.25
    ensureCapacity(numMarkers)

    for (let step = 0; step < numMarkers; step++) {
      if (idx >= MAX_INSTANCE_COUNT) {
        locationMarkersEnabled = false
        return
      }
      const t = step / numMarkers
      const markerTopX = topLeft + (topRight - topLeft) * t
      const markerBottomX = bottomLeft + (bottomRight - bottomLeft) * t

      addInstance(
        markerTopX - lineHalfWidth,
        markerTopX + lineHalfWidth,
        markerBottomX + lineHalfWidth,
        markerBottomX - lineHalfWidth,
        0,
        0,
        0,
        0.25,
        featureId,
        isCurve,
        qtl,
        padTop,
        padBottom,
      )
    }
  }

  const isCurve = drawCurves ? 1 : 0
  const fallbackBpPerPxInv0 = 1 / bpPerPxs[level]!
  const fallbackBpPerPxInv1 = 1 / bpPerPxs[level + 1]!
  const minCigarPxWidth = 4

  // First loop: non-CIGAR instances (features too small for CIGAR or no CIGAR)
  for (let i = 0; i < featureCount; i++) {
    if (idx >= MAX_INSTANCE_COUNT) {
      break
    }
    const cigar = parsedCigars[i]!
    if (cigar.length > 0 && drawCIGAR) {
      const featureWidth = Math.max(
        Math.abs(p12_offsetPx[i]! - p11_offsetPx[i]!),
        Math.abs(p22_offsetPx[i]! - p21_offsetPx[i]!),
      )
      if (featureWidth >= minCigarPxWidth) {
        continue
      }
    }
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

    const [cr, cg, cb, ca] = colorFn(strand, refName, i)
    addInstance(x11, x12, x22, x21, cr, cg, cb, ca, featureId, isCurve, qtl, padTop, padBottom)

    if (locationMarkersEnabled) {
      addLocationMarkers(x11, x12, x22, x21, featureId, isCurve, qtl, padTop, padBottom)
    }
  }

  const nonCigarInstanceCount = idx

  // Second loop: CIGAR instances (using cached parsed CIGARs)
  for (let i = 0; i < featureCount; i++) {
    if (idx >= MAX_INSTANCE_COUNT) {
      break
    }
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

    let totalBpView0 = 0
    let totalBpView1 = 0
    for (let j = 0; j < cigar.length; j += 2) {
      const len = +cigar[j]!
      const op = cigar[j + 1]!
      if (op === 'M' || op === '=' || op === 'X') {
        totalBpView0 += len
        totalBpView1 += len
      } else if (op === 'D' || op === 'N') {
        totalBpView0 += len
      } else if (op === 'I') {
        totalBpView1 += len
      }
    }
    const pxPerBp0 =
      totalBpView0 > 0 ? Math.abs(k2 - k1) / totalBpView0 : fallbackBpPerPxInv0
    const pxPerBp1 =
      totalBpView1 > 0
        ? Math.abs(x22 - x21) / totalBpView1
        : fallbackBpPerPxInv1

    let cx1 = k1
    let cx2 = s1 === -1 ? x22 : x21
    let continuingFlag = false
    let px1 = 0
    let px2 = 0

    for (let j = 0; j < cigar.length; j += 2) {
      if (idx >= MAX_INSTANCE_COUNT) {
        break
      }
      const len = +cigar[j]!
      const op = cigar[j + 1]!

      if (!continuingFlag) {
        px1 = cx1
        px2 = cx2
      }

      const d1 = len * pxPerBp0
      const d2 = len * pxPerBp1

      if (op === 'M' || op === '=' || op === 'X') {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if (op === 'D' || op === 'N') {
        cx1 += d1 * rev1
      } else if (op === 'I') {
        cx2 += d2 * rev2
      }

      if (op === 'D' || op === 'N' || op === 'I') {
        const relevantPx = op === 'I' ? d2 : d1
        if (relevantPx < 1) {
          continuingFlag = true
          continue
        }
      }

      const isNotLast = j < cigar.length - 2
      if (Math.abs(cx1 - px1) <= 1 && Math.abs(cx2 - px2) <= 1 && isNotLast) {
        continuingFlag = true
      } else {
        const letter = (continuingFlag && d1 > 1) || d2 > 1 ? op : 'M'
        continuingFlag = false

        if (drawCIGARMatchesOnly && letter !== 'M') {
          continue
        }

        const [cr, cg, cb, ca] = getCigarColor(
          letter,
          colorBy,
          colorFn,
          strand,
          refName,
          i,
        )
        addInstance(px1, cx1, cx2, px2, cr, cg, cb, ca, featureId, isCurve, qtl, padTop, padBottom)

        if (locationMarkersEnabled) {
          addLocationMarkers(px1, cx1, cx2, px2, featureId, isCurve, qtl, padTop, padBottom)
        }
      }
    }
  }

  const instanceCount = idx

  const result = {
    x1: splitHiLo(x1s, instanceCount),
    x2: splitHiLo(x2s, instanceCount),
    x3: splitHiLo(x3s, instanceCount),
    x4: splitHiLo(x4s, instanceCount),
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
  }

  return result
}

import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'
import { parseCigar } from '@jbrowse/plugin-alignments'

import { colorSchemes } from '../LinearSyntenyDisplay/drawSyntenyUtils.ts'

function splitHiLo(values: number[]) {
  const result = new Float32Array(values.length * 2)
  for (const [i, value] of values.entries()) {
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

function addLocationMarkerInstances(
  x1s: number[],
  x2s: number[],
  x3s: number[],
  x4s: number[],
  colors: number[],
  featureIds: number[],
  isCurves: number[],
  queryTotalLengthArr: number[],
  padTops: number[],
  padBottoms: number[],
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
  featureId: number,
  isCurve: number,
  queryTotalLength: number,
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

  for (let step = 0; step < numMarkers; step++) {
    const t = step / numMarkers
    const markerTopX = topLeft + (topRight - topLeft) * t
    const markerBottomX = bottomLeft + (bottomRight - bottomLeft) * t

    x1s.push(markerTopX - lineHalfWidth)
    x2s.push(markerTopX + lineHalfWidth)
    x3s.push(markerBottomX + lineHalfWidth)
    x4s.push(markerBottomX - lineHalfWidth)
    colors.push(0, 0, 0, 0.25)
    featureIds.push(featureId)
    isCurves.push(isCurve)
    queryTotalLengthArr.push(queryTotalLength)
    padTops.push(padTop)
    padBottoms.push(padBottom)
  }
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

  const x1s: number[] = []
  const x2s: number[] = []
  const x3s: number[] = []
  const x4s: number[] = []
  const colorsArr: number[] = []
  const featureIdsArr: number[] = []
  const isCurvesArr: number[] = []
  const queryTotalLengthArr: number[] = []
  const padTopsArr: number[] = []
  const padBottomsArr: number[] = []

  const isCurve = drawCurves ? 1 : 0
  const fallbackBpPerPxInv0 = 1 / bpPerPxs[level]!
  const fallbackBpPerPxInv1 = 1 / bpPerPxs[level + 1]!
  const minCigarPxWidth = 4

  for (let i = 0; i < featureCount; i++) {
    const cigarStr = cigars[i]!
    const cigar = cigarStr ? parseCigar(cigarStr) : []
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
    x1s.push(x11)
    x2s.push(x12)
    x3s.push(x22)
    x4s.push(x21)
    colorsArr.push(cr, cg, cb, ca)
    featureIdsArr.push(featureId)
    isCurvesArr.push(isCurve)
    queryTotalLengthArr.push(qtl)
    padTopsArr.push(padTop)
    padBottomsArr.push(padBottom)

    if (drawLocationMarkers) {
      addLocationMarkerInstances(
        x1s,
        x2s,
        x3s,
        x4s,
        colorsArr,
        featureIdsArr,
        isCurvesArr,
        queryTotalLengthArr,
        padTopsArr,
        padBottomsArr,
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

  const nonCigarInstanceCount = x1s.length

  for (let i = 0; i < featureCount; i++) {
    const cigarStr = cigars[i]!
    const cigar = cigarStr ? parseCigar(cigarStr) : []
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
        x1s.push(px1)
        x2s.push(cx1)
        x3s.push(cx2)
        x4s.push(px2)
        colorsArr.push(cr, cg, cb, ca)
        featureIdsArr.push(featureId)
        isCurvesArr.push(isCurve)
        queryTotalLengthArr.push(qtl)
        padTopsArr.push(padTop)
        padBottomsArr.push(padBottom)

        if (drawLocationMarkers) {
          addLocationMarkerInstances(
            x1s,
            x2s,
            x3s,
            x4s,
            colorsArr,
            featureIdsArr,
            isCurvesArr,
            queryTotalLengthArr,
            padTopsArr,
            padBottomsArr,
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

  const instanceCount = x1s.length

  const result = {
    x1: splitHiLo(x1s),
    x2: splitHiLo(x2s),
    x3: splitHiLo(x3s),
    x4: splitHiLo(x4s),
    colors: new Float32Array(colorsArr),
    featureIds: new Float32Array(featureIdsArr),
    isCurves: new Float32Array(isCurvesArr),
    queryTotalLengths: new Float32Array(queryTotalLengthArr),
    padTops: new Float32Array(padTopsArr),
    padBottoms: new Float32Array(padBottomsArr),
    instanceCount,
    nonCigarInstanceCount,
    geometryBpPerPx0: bpPerPxs[level]!,
    geometryBpPerPx1: bpPerPxs[level + 1]!,
  }

  const totalBytes =
    result.x1.byteLength +
    result.x2.byteLength +
    result.x3.byteLength +
    result.x4.byteLength +
    result.colors.byteLength +
    result.featureIds.byteLength +
    result.isCurves.byteLength +
    result.queryTotalLengths.byteLength +
    result.padTops.byteLength +
    result.padBottoms.byteLength

  console.log('[WebGL Synteny RPC] Generated instance data:', {
    featureCount,
    instanceCount,
    nonCigarInstanceCount,
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    drawCurves,
    drawCIGAR,
  })

  return result
}

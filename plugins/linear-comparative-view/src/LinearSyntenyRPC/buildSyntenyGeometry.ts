import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/alignments-core'

import {
  KIND_BASE,
  KIND_BASE_HIDDEN,
  KIND_CIGAR_D,
  KIND_CIGAR_HIDDEN,
  KIND_CIGAR_I,
  KIND_CIGAR_MATCH,
  KIND_CIGAR_N,
  KIND_MARKER,
  computeSyntenyColors,
} from './syntenyColors.ts'

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

function growF32(old: Float32Array, count: number, newCapacity: number) {
  const arr = new Float32Array(newCapacity)
  arr.set(old.subarray(0, count))
  return arr
}

function growU32(old: Uint32Array, count: number, newCapacity: number) {
  const arr = new Uint32Array(newCapacity)
  arr.set(old.subarray(0, count))
  return arr
}

function growU8(old: Uint8Array, count: number, newCapacity: number) {
  const arr = new Uint8Array(newCapacity)
  arr.set(old.subarray(0, count))
  return arr
}

function growF64(old: Float64Array, count: number, newCapacity: number) {
  const arr = new Float64Array(newCapacity)
  arr.set(old.subarray(0, count))
  return arr
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
  // Per-instance descriptors driving main-thread color recomputation on
  // colorBy change. `kinds` is one of the `KIND_*` constants from
  // syntenyColors.ts; `instanceFeatureIdx` is the parent feature index in
  // SyntenyFeatureData (strands/refNames/...).
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
  featureIds: Float32Array
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

export function buildSyntenyGeometry({
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
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPxs: number[]
  level: number
  viewOffsets: number[]
  viewWidth: number
}): SyntenyInstanceData {
  const featureCount = p11_offsetPx.length

  // Per-feature total-length-across-same-query-name. Features without a
  // query name don't aggregate — they contribute only their own length.
  const queryTotalLengths = new Map<string, number>()
  for (let i = 0; i < featureCount; i++) {
    const name = names[i]!
    if (name !== '') {
      const alignmentLength = Math.abs(ends[i]! - starts[i]!)
      const current = queryTotalLengths.get(name) ?? 0
      queryTotalLengths.set(name, current + alignmentLength)
    }
  }
  const qtls = new Float32Array(featureCount)
  for (let i = 0; i < featureCount; i++) {
    const name = names[i]!
    qtls[i] =
      name !== ''
        ? queryTotalLengths.get(name)!
        : Math.abs(ends[i]! - starts[i]!)
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
  let kindsArr = new Uint8Array(capacity)
  let featIdxArr = new Uint32Array(capacity)
  let featureIdsArr = new Float32Array(capacity)
  let queryTotalLengthArr = new Float32Array(capacity)
  let padTopsArr = new Float32Array(capacity)
  let padBottomsArr = new Float32Array(capacity)

  let idx = 0

  function ensureCapacity(needed: number) {
    if (idx + needed <= capacity) {
      return
    }
    const newCapacity = Math.max(capacity * 2, idx + needed)
    x1s = growF64(x1s, idx, newCapacity)
    x2s = growF64(x2s, idx, newCapacity)
    x3s = growF64(x3s, idx, newCapacity)
    x4s = growF64(x4s, idx, newCapacity)
    kindsArr = growU8(kindsArr, idx, newCapacity)
    featIdxArr = growU32(featIdxArr, idx, newCapacity)
    featureIdsArr = growF32(featureIdsArr, idx, newCapacity)
    queryTotalLengthArr = growF32(queryTotalLengthArr, idx, newCapacity)
    padTopsArr = growF32(padTopsArr, idx, newCapacity)
    padBottomsArr = growF32(padBottomsArr, idx, newCapacity)
    capacity = newCapacity
  }

  function addInstance(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number,
    kind: number,
    featureIdx: number,
    qtl: number,
    padTop: number,
    padBottom: number,
  ) {
    ensureCapacity(1)
    x1s[idx] = topLeft
    x2s[idx] = topRight
    x3s[idx] = bottomRight
    x4s[idx] = bottomLeft
    kindsArr[idx] = kind
    featIdxArr[idx] = featureIdx
    featureIdsArr[idx] = featureIdx + 1
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
    featureIdx: number,
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
        KIND_MARKER,
        featureIdx,
        qtl,
        padTop,
        padBottom,
      )
    }
  }

  const viewOff0 = viewOffsets[level]!
  const viewOff1 = viewOffsets[level + 1]!
  const offScreenMargin = viewWidth + 1000
  const bpPerPxInv0 = 1 / bpPerPxs[level]!
  const bpPerPxInv1 = 1 / bpPerPxs[level + 1]!
  const minCigarPxWidth = 4
  const willDrawCigarArr = new Uint8Array(featureCount)

  // First loop: emit a whole-polygon instance for every feature.
  // Features that will get CIGAR detail are emitted with KIND_BASE_HIDDEN
  // (alpha-zero in the fill pass but still usable by the edge/outline pass).
  for (let i = 0; i < featureCount; i++) {
    const x11 = p11_offsetPx[i]!
    const x12 = p12_offsetPx[i]!
    const x21 = p21_offsetPx[i]!
    const x22 = p22_offsetPx[i]!
    const qtl = qtls[i]!
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
    willDrawCigarArr[i] = willDrawCigar ? 1 : 0

    addInstance(
      x11,
      x12,
      x22,
      x21,
      willDrawCigar ? KIND_BASE_HIDDEN : KIND_BASE,
      i,
      qtl,
      padTop,
      padBottom,
    )

    if (!willDrawCigar && drawLocationMarkers) {
      addLocationMarkers(x11, x12, x22, x21, i, qtl, padTop, padBottom)
    }
  }

  const nonCigarInstanceCount = idx

  // Second loop: CIGAR instances (using cached parsed CIGARs).
  // NOTE: the accumulator (small-indel merge, op classification, cull)
  // mirrors the Canvas2D/SVG loop in LinearSyntenyDisplay/drawRef.ts.
  // Keep them in sync — any fix here needs the same fix there.
  for (let i = 0; i < featureCount; i++) {
    if (!willDrawCigarArr[i]) {
      continue
    }
    const cigar = parsedCigars[i]!
    const x11 = p11_offsetPx[i]!
    const x12 = p12_offsetPx[i]!
    const x21 = p21_offsetPx[i]!
    const x22 = p22_offsetPx[i]!
    const strand = strands[i]!
    const qtl = qtls[i]!
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
    if (maxIndelLen * Math.max(bpPerPxInv0, bpPerPxInv1) < 1) {
      addInstance(x11, x12, x22, x21, KIND_BASE, i, qtl, padTop, padBottom)
      if (drawLocationMarkers) {
        addLocationMarkers(x11, x12, x22, x21, i, qtl, padTop, padBottom)
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

      const d1 = len * bpPerPxInv0
      const d2 = len * bpPerPxInv1

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
          let kind: number
          if (drawCIGARMatchesOnly && isIndel) {
            kind = KIND_CIGAR_HIDDEN
          } else if (resolvedOp === CIGAR_I) {
            kind = KIND_CIGAR_I
          } else if (resolvedOp === CIGAR_D) {
            kind = KIND_CIGAR_D
          } else if (resolvedOp === CIGAR_N) {
            kind = KIND_CIGAR_N
          } else {
            kind = KIND_CIGAR_MATCH
          }
          addInstance(px1, cx1, cx2, px2, kind, i, qtl, padTop, padBottom)

          if (drawLocationMarkers && !(drawCIGARMatchesOnly && isIndel)) {
            addLocationMarkers(px1, cx1, cx2, px2, i, qtl, padTop, padBottom)
          }
        }
      }
    }
  }

  const instanceCount = idx
  const refOffset0 = viewOffsets[level]!
  const refOffset1 = viewOffsets[level + 1]!
  const kinds = kindsArr.subarray(0, instanceCount)
  const instanceFeatureIdx = featIdxArr.subarray(0, instanceCount)
  // Worker emits default-scheme colors as a usable initial fill; the
  // display model overrides via `renderInstanceData` whenever colorBy
  // changes, so these serve only the first paint and Canvas2D fallback.
  const colors = computeSyntenyColors({
    kinds,
    featureIdx: instanceFeatureIdx,
    strands,
    refNames,
    instanceCount,
    colorBy: 'default',
  })

  return {
    x1: toRelativeFloat32(x1s, instanceCount, refOffset0),
    x2: toRelativeFloat32(x2s, instanceCount, refOffset0),
    x3: toRelativeFloat32(x3s, instanceCount, refOffset1),
    x4: toRelativeFloat32(x4s, instanceCount, refOffset1),
    colors,
    kinds,
    instanceFeatureIdx,
    featureIds: featureIdsArr.subarray(0, instanceCount),
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
}

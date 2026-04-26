import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_N,
  visitCigarRenderedSegments,
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

// Worker-side geometry. `colors` is injected by the main thread (computedColors
// in the display model) and is the only field SyntenyInstanceData adds. Keeps
// the worker output independent of colorBy and lets colorBy changes re-upload
// without an RPC refetch.
export interface SyntenyGeometry {
  x1: Float32Array
  x2: Float32Array
  x3: Float32Array
  x4: Float32Array
  // Per-instance descriptors driving main-thread color recomputation on
  // colorBy change. `kinds` is one of the `KIND_*` constants from
  // syntenyColors.ts; `instanceFeatureIdx` is the parent feature index in
  // SyntenyFeatureData (strands/refNames/...). Picking IDs are derived as
  // `instanceFeatureIdx[i] + 1` at interleave time (0 reserved for "no hit").
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
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

export type SyntenyInstanceData = SyntenyGeometry & { colors: Uint32Array }

export function buildSyntenyGeometry({
  p11_offsetPx,
  p12_offsetPx,
  p21_offsetPx,
  p22_offsetPx,
  padTop: padTopArr,
  padBottom: padBottomArr,
  strands,
  names,
  parsedCigars,
  starts,
  ends,
  drawCIGAR,
  drawCIGARMatchesOnly,
  drawLocationMarkers,
  bpPerPx0,
  bpPerPx1,
  viewOff0,
  viewOff1,
  viewWidth,
  syriTypes,
}: {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  padTop: Float64Array
  padBottom: Float64Array
  strands: Int8Array
  names: string[]
  parsedCigars: number[][]
  starts: Float64Array
  ends: Float64Array
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
  drawLocationMarkers: boolean
  bpPerPx0: number
  bpPerPx1: number
  viewOff0: number
  viewOff1: number
  viewWidth: number
  syriTypes?: (string | undefined)[]
}): SyntenyGeometry {
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

  const offScreenMargin = viewWidth + 1000
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1
  const minCigarPxWidth = 4
  const maxBpPerPxInv = Math.max(bpPerPxInv0, bpPerPxInv1)

  const qtls = new Float32Array(featureCount)
  const willDrawCigarArr = new Uint8Array(featureCount)
  // Precomputed in pre-pass to avoid recomputing during CIGAR emission. Stored
  // as Uint32 because CIGAR op lengths are < 2^28 in practice.
  const maxIndelLens = new Uint32Array(featureCount)

  // Single pre-pass: fill qtls, willDrawCigar, maxIndelLen, and accumulate
  // capacity estimate. Each feature contributes at minimum 1 instance; CIGAR
  // features below the indel-pixel threshold short-circuit to 1 KIND_BASE so
  // we don't budget their full op count there.
  let estimate = 0
  for (let i = 0; i < featureCount; i++) {
    const name = names[i]!
    qtls[i] =
      name !== ''
        ? queryTotalLengths.get(name)!
        : Math.abs(ends[i]! - starts[i]!)

    const cigar = parsedCigars[i]!
    let willDrawCigar = false
    let willDrawDetailedCigar = false
    if (cigar.length > 0 && drawCIGAR) {
      const featureWidth = Math.max(
        Math.abs(p12_offsetPx[i]! - p11_offsetPx[i]!),
        Math.abs(p22_offsetPx[i]! - p21_offsetPx[i]!),
      )
      if (featureWidth >= minCigarPxWidth) {
        willDrawCigar = true
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
        maxIndelLens[i] = maxIndelLen
        willDrawDetailedCigar = maxIndelLen * maxBpPerPxInv >= 1
      }
    }
    willDrawCigarArr[i] = willDrawCigar ? 1 : 0

    // 1 base in pass 1; pass 2 emits N cigar ops if detailed, else 1 KIND_BASE.
    estimate += 1 + (willDrawDetailedCigar ? cigar.length : willDrawCigar ? 1 : 0)
  }

  // Pre-allocate buffers with estimated capacity. Location markers grow the
  // buffer dynamically since the actual count depends on per-feature widths
  // (skipped for features < 30px) — overshooting here would cost more than
  // the amortized doubling cost of `ensureCapacity`.
  let capacity = drawLocationMarkers ? estimate * 2 : estimate

  let x1s = new Float64Array(capacity)
  let x2s = new Float64Array(capacity)
  let x3s = new Float64Array(capacity)
  let x4s = new Float64Array(capacity)
  let kindsArr = new Uint8Array(capacity)
  let featIdxArr = new Uint32Array(capacity)
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
      const t = step / (numMarkers - 1)
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

  // First loop: emit whole-polygon instances, SYN features first so that
  // INV/TRANS/DUP ribbons render on top in the GPU path (painter's order).
  // When syriTypes is absent (non-SyRI data) the single pass is unchanged.
  // Features with CIGAR detail use KIND_BASE_HIDDEN (alpha-zero in the fill
  // pass but still drawn by the edge/outline pass).
  function emitNonCigarFeature(i: number) {
    const x11 = p11_offsetPx[i]!
    const x12 = p12_offsetPx[i]!
    const x21 = p21_offsetPx[i]!
    const x22 = p22_offsetPx[i]!
    const willDrawCigar = willDrawCigarArr[i]!
    addInstance(
      x11,
      x12,
      x22,
      x21,
      willDrawCigar ? KIND_BASE_HIDDEN : KIND_BASE,
      i,
      qtls[i]!,
      padTopArr[i]!,
      padBottomArr[i]!,
    )
    if (!willDrawCigar && drawLocationMarkers) {
      addLocationMarkers(
        x11,
        x12,
        x22,
        x21,
        i,
        qtls[i]!,
        padTopArr[i]!,
        padBottomArr[i]!,
      )
    }
  }

  if (syriTypes) {
    for (let i = 0; i < featureCount; i++) {
      if (syriTypes[i] === 'SYN') {
        emitNonCigarFeature(i)
      }
    }
    for (let i = 0; i < featureCount; i++) {
      if (syriTypes[i] !== 'SYN') {
        emitNonCigarFeature(i)
      }
    }
  } else {
    for (let i = 0; i < featureCount; i++) {
      emitNonCigarFeature(i)
    }
  }

  const nonCigarInstanceCount = idx

  // Second loop: CIGAR instances (using cached parsed CIGARs).
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

    if (maxIndelLens[i]! * maxBpPerPxInv < 1) {
      addInstance(x11, x12, x22, x21, KIND_BASE, i, qtl, padTop, padBottom)
      if (drawLocationMarkers) {
        addLocationMarkers(x11, x12, x22, x21, i, qtl, padTop, padBottom)
      }
      continue
    }

    visitCigarRenderedSegments(
      cigar,
      k1,
      s1 === -1 ? x22 : x21,
      bpPerPxInv0,
      bpPerPxInv1,
      rev1,
      rev2,
      (resolvedOp, px1, cx1, px2, cx2) => {
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
      },
    )
  }

  const instanceCount = idx

  return {
    x1: toRelativeFloat32(x1s, instanceCount, viewOff0),
    x2: toRelativeFloat32(x2s, instanceCount, viewOff0),
    x3: toRelativeFloat32(x3s, instanceCount, viewOff1),
    x4: toRelativeFloat32(x4s, instanceCount, viewOff1),
    kinds: kindsArr.subarray(0, instanceCount),
    instanceFeatureIdx: featIdxArr.subarray(0, instanceCount),
    queryTotalLengths: queryTotalLengthArr.subarray(0, instanceCount),
    padTops: padTopsArr.subarray(0, instanceCount),
    padBottoms: padBottomsArr.subarray(0, instanceCount),
    instanceCount,
    nonCigarInstanceCount,
    geometryBpPerPx0: bpPerPx0,
    geometryBpPerPx1: bpPerPx1,
    refOffset0: viewOff0,
    refOffset1: viewOff1,
  }
}

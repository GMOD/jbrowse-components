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

// Worker-side geometry. `colors` is injected by the main thread (computedColors
// in the display model) and is the only field SyntenyInstanceData adds. Keeps
// the worker output independent of colorBy and lets colorBy changes re-upload
// without an RPC refetch.
//
// Corner positions are stored as cumulative-bp (NOT pixel) hi/lo Float32
// pairs. Combined with the per-instance pad{Top,Bottom} pixel offsets these
// reconstruct the screen position via hp-math in the vertex shader, which
// avoids the Float32 precision blow-up that pixel-space storage suffered when
// the mate was on a distant chromosome.
export interface SyntenyGeometry {
  bp1Hi: Float32Array
  bp1Lo: Float32Array
  bp2Hi: Float32Array
  bp2Lo: Float32Array
  bp3Hi: Float32Array
  bp3Lo: Float32Array
  bp4Hi: Float32Array
  bp4Lo: Float32Array
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
  starts: Uint32Array
  ends: Uint32Array
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

  const panBufferPx = 2000
  const emitLeft = -panBufferPx
  const emitRight = viewWidth + panBufferPx
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
    estimate +=
      1 + (willDrawDetailedCigar ? cigar.length : willDrawCigar ? 1 : 0)
  }

  // Pre-allocate buffers with estimated capacity. Location markers grow the
  // buffer dynamically since the actual count depends on per-feature widths
  // (skipped for features < 30px) — overshooting here would cost more than
  // the amortized doubling cost of `ensureCapacity`.
  let capacity = drawLocationMarkers ? estimate * 2 : estimate

  // Write cumBp hi/lo Float32 pairs directly at emit time. The shader
  // reconstructs screen pixel via `(cumBpHi + cumBpLo) / bpPerPx + pad` using
  // hp-math, so the worker never needs to materialize Float64 padded-pixel
  // staging arrays — converting and splitting happens inline in `addInstance`.
  // Lower peak memory + one fewer round of large-buffer allocation vs. the
  // prior pxArrayToBpHiLo sweep.
  let bp1HiArr = new Float32Array(capacity)
  let bp1LoArr = new Float32Array(capacity)
  let bp2HiArr = new Float32Array(capacity)
  let bp2LoArr = new Float32Array(capacity)
  let bp3HiArr = new Float32Array(capacity)
  let bp3LoArr = new Float32Array(capacity)
  let bp4HiArr = new Float32Array(capacity)
  let bp4LoArr = new Float32Array(capacity)
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
    bp1HiArr = growF32(bp1HiArr, idx, newCapacity)
    bp1LoArr = growF32(bp1LoArr, idx, newCapacity)
    bp2HiArr = growF32(bp2HiArr, idx, newCapacity)
    bp2LoArr = growF32(bp2LoArr, idx, newCapacity)
    bp3HiArr = growF32(bp3HiArr, idx, newCapacity)
    bp3LoArr = growF32(bp3LoArr, idx, newCapacity)
    bp4HiArr = growF32(bp4HiArr, idx, newCapacity)
    bp4LoArr = growF32(bp4LoArr, idx, newCapacity)
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
    // Inline (px - pad) * bpPerPx → splitPositionWithFrac. Avoids tuple
    // allocation per call on the per-instance hot path.
    const cumBp1 = (topLeft - padTop) * bpPerPx0
    const intValue1 = Math.floor(cumBp1)
    const loInt1 = intValue1 - Math.floor(intValue1 / 4096) * 4096
    bp1HiArr[idx] = intValue1 - loInt1
    bp1LoArr[idx] = loInt1 + (cumBp1 - intValue1)

    const cumBp2 = (topRight - padTop) * bpPerPx0
    const intValue2 = Math.floor(cumBp2)
    const loInt2 = intValue2 - Math.floor(intValue2 / 4096) * 4096
    bp2HiArr[idx] = intValue2 - loInt2
    bp2LoArr[idx] = loInt2 + (cumBp2 - intValue2)

    const cumBp3 = (bottomRight - padBottom) * bpPerPx1
    const intValue3 = Math.floor(cumBp3)
    const loInt3 = intValue3 - Math.floor(intValue3 / 4096) * 4096
    bp3HiArr[idx] = intValue3 - loInt3
    bp3LoArr[idx] = loInt3 + (cumBp3 - intValue3)

    const cumBp4 = (bottomLeft - padBottom) * bpPerPx1
    const intValue4 = Math.floor(cumBp4)
    const loInt4 = intValue4 - Math.floor(intValue4 / 4096) * 4096
    bp4HiArr[idx] = intValue4 - loInt4
    bp4LoArr[idx] = loInt4 + (cumBp4 - intValue4)

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
        (screenTopX < emitLeft || screenTopX > emitRight) &&
        (screenBottomX < emitLeft || screenBottomX > emitRight)
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
          (topMax < emitLeft || topMin > emitRight) &&
          (botMax < emitLeft || botMin > emitRight)

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
    bp1Hi: bp1HiArr.subarray(0, instanceCount),
    bp1Lo: bp1LoArr.subarray(0, instanceCount),
    bp2Hi: bp2HiArr.subarray(0, instanceCount),
    bp2Lo: bp2LoArr.subarray(0, instanceCount),
    bp3Hi: bp3HiArr.subarray(0, instanceCount),
    bp3Lo: bp3LoArr.subarray(0, instanceCount),
    bp4Hi: bp4HiArr.subarray(0, instanceCount),
    bp4Lo: bp4LoArr.subarray(0, instanceCount),
    kinds: kindsArr.subarray(0, instanceCount),
    instanceFeatureIdx: featIdxArr.subarray(0, instanceCount),
    queryTotalLengths: queryTotalLengthArr.subarray(0, instanceCount),
    padTops: padTopsArr.subarray(0, instanceCount),
    padBottoms: padBottomsArr.subarray(0, instanceCount),
    instanceCount,
    nonCigarInstanceCount,
  }
}

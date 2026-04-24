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
  computeSyntenyColors,
} from './syntenyColors.ts'

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

function growF32(old: Float32Array, count: number, newCapacity: number) {
  const arr = new Float32Array(newCapacity)
  arr.set(old.subarray(0, count))
  return arr
}

function estimateInstanceCount(
  featureCount: number,
  parsedCigars: number[][],
  drawCIGAR: boolean,
) {
  let estimate = featureCount
  if (drawCIGAR) {
    for (let i = 0; i < featureCount; i++) {
      estimate += parsedCigars[i]!.length
    }
  }
  return estimate
}

export interface SyntenyInstanceData {
  // bp-in-region for each corner. The main thread and shader project these
  // against per-view `regionOffsetPx[regionIdx]` + `bpPerPx` tables to get
  // screen pixels. See syntenyProjection.ts.
  x1: Uint32Array
  x2: Uint32Array
  x3: Uint32Array
  x4: Uint32Array
  topRegionIdx: Uint8Array
  botRegionIdx: Uint8Array
  colors: Uint32Array
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
  featureIds: Float32Array
  queryTotalLengths: Float32Array
  instanceCount: number
  nonCigarInstanceCount: number
}

export function buildSyntenyGeometry({
  p11_bp,
  p12_bp,
  p21_bp,
  p22_bp,
  topRegionIdx: topRegionIdxArr,
  botRegionIdx: botRegionIdxArr,
  strands,
  names,
  refNames,
  parsedCigars,
  starts,
  ends,
  drawCIGAR,
  drawCIGARMatchesOnly,
}: {
  p11_bp: Uint32Array
  p12_bp: Uint32Array
  p21_bp: Uint32Array
  p22_bp: Uint32Array
  topRegionIdx: Uint8Array
  botRegionIdx: Uint8Array
  strands: Int8Array
  names: string[]
  refNames: string[]
  parsedCigars: number[][]
  starts: Float64Array
  ends: Float64Array
  drawCIGAR: boolean
  drawCIGARMatchesOnly: boolean
}): SyntenyInstanceData {
  const featureCount = p11_bp.length

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

  let capacity = estimateInstanceCount(featureCount, parsedCigars, drawCIGAR)

  let x1s = new Uint32Array(capacity)
  let x2s = new Uint32Array(capacity)
  let x3s = new Uint32Array(capacity)
  let x4s = new Uint32Array(capacity)
  let topRegIdxOut = new Uint8Array(capacity)
  let botRegIdxOut = new Uint8Array(capacity)
  let kindsArr = new Uint8Array(capacity)
  let featIdxArr = new Uint32Array(capacity)
  let featureIdsArr = new Float32Array(capacity)
  let queryTotalLengthArr = new Float32Array(capacity)

  let idx = 0

  function ensureCapacity(needed: number) {
    if (idx + needed <= capacity) {
      return
    }
    const newCapacity = Math.max(capacity * 2, idx + needed)
    x1s = growU32(x1s, idx, newCapacity)
    x2s = growU32(x2s, idx, newCapacity)
    x3s = growU32(x3s, idx, newCapacity)
    x4s = growU32(x4s, idx, newCapacity)
    topRegIdxOut = growU8(topRegIdxOut, idx, newCapacity)
    botRegIdxOut = growU8(botRegIdxOut, idx, newCapacity)
    kindsArr = growU8(kindsArr, idx, newCapacity)
    featIdxArr = growU32(featIdxArr, idx, newCapacity)
    featureIdsArr = growF32(featureIdsArr, idx, newCapacity)
    queryTotalLengthArr = growF32(queryTotalLengthArr, idx, newCapacity)
    capacity = newCapacity
  }

  function addInstance(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number,
    topRegIdx: number,
    botRegIdx: number,
    kind: number,
    featureIdx: number,
    qtl: number,
  ) {
    ensureCapacity(1)
    x1s[idx] = topLeft
    x2s[idx] = topRight
    x3s[idx] = bottomRight
    x4s[idx] = bottomLeft
    topRegIdxOut[idx] = topRegIdx
    botRegIdxOut[idx] = botRegIdx
    kindsArr[idx] = kind
    featIdxArr[idx] = featureIdx
    featureIdsArr[idx] = featureIdx + 1
    queryTotalLengthArr[idx] = qtl
    idx++
  }

  const willDrawCigarArr = new Uint8Array(featureCount)

  // First loop: whole-polygon instances. Features with CIGAR detail get
  // KIND_BASE_HIDDEN (alpha-zero in fill, still usable by the edge pass).
  // Sub-pixel-width decisions are deferred to the main-thread projection now.
  for (let i = 0; i < featureCount; i++) {
    const x11 = p11_bp[i]!
    const x12 = p12_bp[i]!
    const x21 = p21_bp[i]!
    const x22 = p22_bp[i]!
    const topReg = topRegionIdxArr[i]!
    const botReg = botRegionIdxArr[i]!
    const qtl = qtls[i]!

    const cigar = parsedCigars[i]!
    const willDrawCigar = cigar.length > 0 && drawCIGAR
    willDrawCigarArr[i] = willDrawCigar ? 1 : 0

    addInstance(
      x11,
      x12,
      x22,
      x21,
      topReg,
      botReg,
      willDrawCigar ? KIND_BASE_HIDDEN : KIND_BASE,
      i,
      qtl,
    )
  }

  const nonCigarInstanceCount = idx

  // Second loop: CIGAR instances. Accumulator runs in integer bp — signed
  // arithmetic so a reversed walk can dip below zero within the tracked
  // variables (we clamp to Uint32 only on write). Sub-pixel indel merge
  // that used to live here is now LOD-approximate: dropped in favor of the
  // main-thread projection gating.
  //
  // NOTE: mirrors the Canvas2D/SVG loop in drawRef.ts. Keep them in sync.
  for (let i = 0; i < featureCount; i++) {
    if (!willDrawCigarArr[i]) {
      continue
    }
    const cigar = parsedCigars[i]!
    const x11 = p11_bp[i]!
    const x12 = p12_bp[i]!
    const x21 = p21_bp[i]!
    const x22 = p22_bp[i]!
    const topReg = topRegionIdxArr[i]!
    const botReg = botRegionIdxArr[i]!
    const strand = strands[i]!
    const qtl = qtls[i]!

    const s1 = strand
    const k1 = s1 === -1 ? x12 : x11
    const k2 = s1 === -1 ? x11 : x12
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * s1

    let cx1 = k1
    let cx2 = s1 === -1 ? x22 : x21
    let px1 = 0
    let px2 = 0

    for (let j = 0; j < cigar.length; j++) {
      const packed = cigar[j]!
      const len = packed >>> 4
      const op = packed & 0xf

      px1 = cx1
      px2 = cx2

      const d1 = len
      const d2 = len

      if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if (op === CIGAR_D || op === CIGAR_N) {
        cx1 += d1 * rev1
      } else if (op === CIGAR_I) {
        cx2 += d2 * rev2
      }

      const isIndel = op === CIGAR_I || op === CIGAR_D || op === CIGAR_N
      let kind: number
      if (drawCIGARMatchesOnly && isIndel) {
        kind = KIND_CIGAR_HIDDEN
      } else if (op === CIGAR_I) {
        kind = KIND_CIGAR_I
      } else if (op === CIGAR_D) {
        kind = KIND_CIGAR_D
      } else if (op === CIGAR_N) {
        kind = KIND_CIGAR_N
      } else {
        kind = KIND_CIGAR_MATCH
      }
      addInstance(px1, cx1, cx2, px2, topReg, botReg, kind, i, qtl)
    }
  }

  const instanceCount = idx
  const kinds = kindsArr.subarray(0, instanceCount)
  const instanceFeatureIdx = featIdxArr.subarray(0, instanceCount)
  const colors = computeSyntenyColors({
    kinds,
    featureIdx: instanceFeatureIdx,
    strands,
    refNames,
    instanceCount,
    colorBy: 'default',
  })

  return {
    x1: x1s.subarray(0, instanceCount),
    x2: x2s.subarray(0, instanceCount),
    x3: x3s.subarray(0, instanceCount),
    x4: x4s.subarray(0, instanceCount),
    topRegionIdx: topRegIdxOut.subarray(0, instanceCount),
    botRegionIdx: botRegIdxOut.subarray(0, instanceCount),
    colors,
    kinds,
    instanceFeatureIdx,
    featureIds: featureIdsArr.subarray(0, instanceCount),
    queryTotalLengths: queryTotalLengthArr.subarray(0, instanceCount),
    instanceCount,
    nonCigarInstanceCount,
  }
}

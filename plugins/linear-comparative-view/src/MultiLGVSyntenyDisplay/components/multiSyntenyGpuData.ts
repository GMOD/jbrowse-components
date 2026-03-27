import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
  InstanceBuilder,
} from '@jbrowse/alignments-core'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { cssColorToNormalizedRgba } from '@jbrowse/core/util/colorBits'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { parseCsSeqLen } from '@jbrowse/alignments-core'
import { getFeatureColor } from './multiSyntenyColorUtils.ts'
import { INSTANCE_BYTE_SIZE } from './multiSyntenyGpuShaders.ts'

import type { SyntenyColors } from './multiSyntenyBackendTypes.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export type RefNameIndex = Map<string, { startIdx: number; count: number }>

export interface MultiSyntenyGpuInstanceData {
  buffer: ArrayBuffer
  instanceCount: number
  refNameIndex: RefNameIndex
}

export interface RegionRenderParams {
  bpRangeHi: number
  bpRangeLo: number
  bpRangeLen: number
  regionScreenLeft: number
  regionScreenWidth: number
  instanceOffset: number
  instanceCount: number
}

type RGBA = [number, number, number, number]

function buildColorArrays(colors: SyntenyColors) {
  const mismatch: RGBA = cssColorToNormalizedRgba(colors.mismatch)
  const deletion: RGBA = cssColorToNormalizedRgba(colors.deletion)
  const insertion: RGBA = cssColorToNormalizedRgba(colors.insertion)
  const aRgba = cssColorToNormalizedRgba(colors.baseA)
  const cRgba = cssColorToNormalizedRgba(colors.baseC)
  const gRgba = cssColorToNormalizedRgba(colors.baseG)
  const tRgba = cssColorToNormalizedRgba(colors.baseT)
  const bases: Record<string, RGBA> = {
    A: aRgba,
    a: aRgba,
    C: cRgba,
    c: cRgba,
    G: gRgba,
    g: gRgba,
    T: tRgba,
    t: tRgba,
  }
  return { mismatch, deletion, insertion, bases }
}

function addInstance(
  builder: InstanceBuilder,
  origRefNames: string[],
  startBp: number,
  endBp: number,
  genomeRow: number,
  featureId: number,
  r: number,
  g: number,
  b: number,
  a: number,
  origRefName: string,
) {
  const off = builder.alloc()
  builder.u32[off] = startBp >>> 0
  builder.u32[off + 1] = endBp >>> 0
  builder.u32[off + 2] = genomeRow >>> 0
  builder.u32[off + 3] = featureId >>> 0
  builder.f32[off + 4] = r
  builder.f32[off + 5] = g
  builder.f32[off + 6] = b
  builder.f32[off + 7] = a
  origRefNames.push(origRefName)
}

function expandCigarOps(
  builder: InstanceBuilder,
  origRefNames: string[],
  cigar: number[],
  featStart: number,
  genomeRow: number,
  featureId: number,
  origRefName: string,
  rgba: ReturnType<typeof buildColorArrays>,
) {
  let refPos = 0
  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      refPos += len
    } else if (op === CIGAR_X) {
      const [r, g, b, a] = rgba.mismatch
      addInstance(
        builder,
        origRefNames,
        featStart + refPos,
        featStart + refPos + len,
        genomeRow,
        featureId,
        r,
        g,
        b,
        a,
        origRefName,
      )
      refPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      const [r, g, b, a] = rgba.deletion
      addInstance(
        builder,
        origRefNames,
        featStart + refPos,
        featStart + refPos + len,
        genomeRow,
        featureId,
        r,
        g,
        b,
        a,
        origRefName,
      )
      refPos += len
    } else if (op === CIGAR_I) {
      const [r, g, b, a] = rgba.insertion
      addInstance(
        builder,
        origRefNames,
        featStart + refPos,
        featStart + refPos,
        genomeRow,
        featureId,
        r,
        g,
        b,
        a,
        origRefName,
      )
    }
  }
}

function expandCsOps(
  builder: InstanceBuilder,
  origRefNames: string[],
  cs: string,
  featStart: number,
  genomeRow: number,
  featureId: number,
  origRefName: string,
  rgba: ReturnType<typeof buildColorArrays>,
) {
  let refPos = 0
  let i = 0

  while (i < cs.length) {
    const ch = cs[i]!

    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      const queryBase = cs[i + 2] ?? ''
      const [r, g, b, a] = rgba.bases[queryBase] ?? rgba.mismatch
      addInstance(
        builder,
        origRefNames,
        featStart + refPos,
        featStart + refPos + 1,
        genomeRow,
        featureId,
        r,
        g,
        b,
        a,
        origRefName,
      )
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        const [r, g, b, a] = rgba.deletion
        addInstance(
          builder,
          origRefNames,
          featStart + refPos,
          featStart + refPos + len,
          genomeRow,
          featureId,
          r,
          g,
          b,
          a,
          origRefName,
        )
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        const [r, g, b, a] = rgba.insertion
        addInstance(
          builder,
          origRefNames,
          featStart + refPos,
          featStart + refPos,
          genomeRow,
          featureId,
          r,
          g,
          b,
          a,
          origRefName,
        )
      }
    } else {
      i++
    }
  }
}

// SYNC: field layout must match Instance struct in multiSyntenyGpuShaders.ts
// [startBp: u32, endBp: u32, genomeRow: u32, featureId: u32, r: f32, g: f32, b: f32, a: f32]
export function prepareMultiSyntenyGpuData(
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  colorBy: string,
  showSnps: boolean,
  colors: SyntenyColors,
): MultiSyntenyGpuInstanceData {
  const rgba = buildColorArrays(colors)
  // Estimate capacity
  let totalFeatures = 0
  for (const genome of displayedGenomes) {
    const features = genomeRows.get(genome)
    if (features) {
      totalFeatures += features.length
    }
  }

  const builder = new InstanceBuilder(INSTANCE_BYTE_SIZE, totalFeatures * 2)
  const origRefNames: string[] = []

  let featureIdx = 0
  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const features = genomeRows.get(genomeName)
    if (!features) {
      continue
    }
    for (const feat of features) {
      const fId = ++featureIdx
      const origRefName = feat.origRefName
      const color = getFeatureColor(feat, colorBy)
      const [cr, cg, cb, ca] = cssColorToNormalizedRgba(color)

      addInstance(
        builder,
        origRefNames,
        feat.start,
        feat.end,
        g,
        fId,
        cr,
        cg,
        cb,
        ca,
        origRefName,
      )

      if (showSnps) {
        if (feat.cs) {
          expandCsOps(
            builder,
            origRefNames,
            feat.cs,
            feat.start,
            g,
            fId,
            origRefName,
            rgba,
          )
        } else if (feat.cigar) {
          const parsed = parseCigar2(feat.cigar)
          expandCigarOps(
            builder,
            origRefNames,
            parsed,
            feat.start,
            g,
            fId,
            origRefName,
            rgba,
          )
        }
      }
    }
  }

  const n = builder.getCount()
  const rawBuf = builder.getBuffer()
  const names = origRefNames

  // Create sort indices
  const indices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    indices[i] = i
  }
  const u32View = new Uint32Array(rawBuf)
  const stride = INSTANCE_BYTE_SIZE / 4

  indices.sort((a, b) => {
    const cmp = names[a]!.localeCompare(names[b]!)
    if (cmp !== 0) {
      return cmp
    }
    return u32View[a * stride]! - u32View[b * stride]!
  })

  // Write sorted buffer
  const sortedBuf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
  const srcBytes = new Uint8Array(rawBuf)
  const dstBytes = new Uint8Array(sortedBuf)

  const refNameIndex: RefNameIndex = new Map()
  let currentRefName = ''
  let regionStartIdx = 0

  for (let i = 0; i < n; i++) {
    const srcIdx = indices[i]!
    dstBytes.set(
      srcBytes.subarray(
        srcIdx * INSTANCE_BYTE_SIZE,
        (srcIdx + 1) * INSTANCE_BYTE_SIZE,
      ),
      i * INSTANCE_BYTE_SIZE,
    )

    const refName = names[srcIdx]!
    if (refName !== currentRefName) {
      if (currentRefName !== '' && i > regionStartIdx) {
        refNameIndex.set(currentRefName, {
          startIdx: regionStartIdx,
          count: i - regionStartIdx,
        })
      }
      currentRefName = refName
      regionStartIdx = i
    }
  }
  if (currentRefName !== '' && n > regionStartIdx) {
    refNameIndex.set(currentRefName, {
      startIdx: regionStartIdx,
      count: n - regionStartIdx,
    })
  }

  return { buffer: sortedBuf, instanceCount: n, refNameIndex }
}

export function computeRegionRenderParams(
  block: BaseBlock,
  viewOffsetPx: number,
  refNameIndex: RefNameIndex,
) {
  const entry = refNameIndex.get(block.refName)
  if (!entry || entry.count === 0) {
    return undefined
  }

  const [bpRangeHi, bpRangeLo] = splitPositionWithFrac(block.start)
  const bpRangeLen = block.end - block.start
  const regionScreenLeft = block.offsetPx - viewOffsetPx
  const regionScreenWidth = block.widthPx

  return {
    bpRangeHi,
    bpRangeLo,
    bpRangeLen,
    regionScreenLeft,
    regionScreenWidth,
    instanceOffset: entry.startIdx,
    instanceCount: entry.count,
  } satisfies RegionRenderParams
}

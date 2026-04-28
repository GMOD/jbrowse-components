import {
  InstanceBuilder,
  downsampleMinMax,
  packSnpSegmentsForGpu,
  visitCigarOps,
  visitCsOps,
} from '@jbrowse/alignments-core'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { getFeatureColor } from './multiSyntenyColorUtils.ts'
import {
  FIELD_OFFSET_F32 as COVERAGE_FIELD,
  INSTANCE_STRIDE_F32 as COVERAGE_STRIDE,
} from './shaders/multiSyntenyCoverage.generated.ts'
import {
  FIELD_OFFSET_F32 as FILL_FIELD,
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE,
  INSTANCE_STRIDE_F32 as FILL_STRIDE,
} from './shaders/multiSyntenyFill.generated.ts'
import { INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES } from './shaders/multiSyntenyIndicator.generated.ts'

import type { SyntenyColors } from './multiSyntenyBackendTypes.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface BlockGeometryData {
  buffer: ArrayBuffer
  instanceCount: number
}

export interface BlockRenderParams {
  bpRangeHi: number
  bpRangeLo: number
  bpRangeLen: number
  regionScreenLeft: number
  regionScreenWidth: number
}

export interface BlockCoverageUploadData {
  buffer: ArrayBuffer
  binCount: number
}

function buildColorArrays(colors: SyntenyColors) {
  const mismatch = cssColorToABGR(colors.mismatch)
  const deletion = cssColorToABGR(colors.deletion)
  const insertion = cssColorToABGR(colors.insertion)
  const baseA = cssColorToABGR(colors.baseA)
  const baseC = cssColorToABGR(colors.baseC)
  const baseG = cssColorToABGR(colors.baseG)
  const baseT = cssColorToABGR(colors.baseT)
  const bases: Record<string, number> = {
    A: baseA,
    a: baseA,
    C: baseC,
    c: baseC,
    G: baseG,
    g: baseG,
    T: baseT,
    t: baseT,
  }
  return { mismatch, deletion, insertion, bases }
}

function addInstance(
  builder: InstanceBuilder,
  startBp: number,
  endBp: number,
  genomeRow: number,
  featureId: number,
  color: number,
) {
  const off = builder.alloc()
  builder.u32[off + FILL_FIELD.startBp] = startBp >>> 0
  builder.u32[off + FILL_FIELD.endBp] = endBp >>> 0
  builder.u32[off + FILL_FIELD.genomeRow] = genomeRow >>> 0
  builder.u32[off + FILL_FIELD.featureId] = featureId >>> 0
  builder.u32[off + FILL_FIELD.color] = color
}

function makeGpuOpsVisitor(
  builder: InstanceBuilder,
  genomeRow: number,
  featureId: number,
  rgba: ReturnType<typeof buildColorArrays>,
) {
  return {
    onMismatch(refPos: number, len: number, queryBase?: string) {
      const color =
        (queryBase ? rgba.bases[queryBase] : undefined) ?? rgba.mismatch
      addInstance(builder, refPos, refPos + len, genomeRow, featureId, color)
    },
    onDeletion(refPos: number, len: number) {
      addInstance(
        builder,
        refPos,
        refPos + len,
        genomeRow,
        featureId,
        rgba.deletion,
      )
    },
    onInsertion(refPos: number, _len: number) {
      addInstance(builder, refPos, refPos, genomeRow, featureId, rgba.insertion)
    },
  }
}

// SYNC: field layout must match Instance struct in multiSyntenyGpuShaders.ts
// [startBp: u32, endBp: u32, genomeRow: u32, featureId: u32, color: u32, _pad×3]
export function prepareBlockGeometry(
  genomeFeatures: [string, MultiPairFeature[]][],
  displayedGenomes: string[],
  colorBy: string,
  showSnps: boolean,
  colors: SyntenyColors,
): BlockGeometryData {
  const rgba = buildColorArrays(colors)
  let totalFeatures = 0
  for (const [, features] of genomeFeatures) {
    totalFeatures += features.length
  }

  const builder = new InstanceBuilder(INSTANCE_BYTE_SIZE, totalFeatures * 2)

  const genomeIndexMap = new Map(
    displayedGenomes.map((g, i) => [g, i] as const),
  )

  let featureIdx = 0
  for (const [genomeName, features] of genomeFeatures) {
    const g = genomeIndexMap.get(genomeName)
    if (g === undefined) {
      continue
    }
    for (const feat of features) {
      const fId = ++featureIdx
      addInstance(
        builder,
        feat.start,
        feat.end,
        g,
        fId,
        cssColorToABGR(getFeatureColor(feat, colorBy)),
      )

      if (showSnps) {
        const visitor = makeGpuOpsVisitor(builder, g, fId, rgba)
        if (feat.cs) {
          visitCsOps(feat.cs, feat.start, visitor)
        } else if (feat.cigar) {
          visitCigarOps(parseCigar2(feat.cigar), feat.start, visitor)
        }
      }
    }
  }

  const n = builder.getCount()
  const rawBuf = builder.getBuffer()

  // Sort by genomeRow then start position for rendering order
  const indices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    indices[i] = i
  }
  const u32View = new Uint32Array(rawBuf)
  indices.sort((a, b) => {
    const rowA = u32View[a * FILL_STRIDE + FILL_FIELD.genomeRow]!
    const rowB = u32View[b * FILL_STRIDE + FILL_FIELD.genomeRow]!
    if (rowA !== rowB) {
      return rowA - rowB
    }
    return (
      u32View[a * FILL_STRIDE + FILL_FIELD.startBp]! -
      u32View[b * FILL_STRIDE + FILL_FIELD.startBp]!
    )
  })

  const sortedBuf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
  const srcBytes = new Uint8Array(rawBuf)
  const dstBytes = new Uint8Array(sortedBuf)

  for (let i = 0; i < n; i++) {
    const srcIdx = indices[i]!
    dstBytes.set(
      srcBytes.subarray(
        srcIdx * INSTANCE_BYTE_SIZE,
        (srcIdx + 1) * INSTANCE_BYTE_SIZE,
      ),
      i * INSTANCE_BYTE_SIZE,
    )
  }

  return { buffer: sortedBuf, instanceCount: n }
}

export function computeBlockRenderParams(
  block: ContentBlock,
  viewOffsetPx: number,
): BlockRenderParams {
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
  }
}

// Pack per-bp coverage depths into a GPU buffer for a single block.
// Returns downsampled min/max bands: [position: f32, minDepth: f32, maxDepth: f32] per bin.
export function packCoverageForGpu(
  depths: Float32Array,
  startOffset: number,
  maxDepth: number,
  viewWidthPx = 2000,
): BlockCoverageUploadData {
  if (maxDepth === 0 || depths.length === 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }

  const ds = downsampleMinMax(depths, startOffset, viewWidthPx, maxDepth)
  if (ds.count === 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }

  const buffer = new ArrayBuffer(ds.count * COVERAGE_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < ds.count; i++) {
    const o = i * COVERAGE_STRIDE
    // Store absolute genome coordinates so the shader can map bins to
    // any content block by subtracting block.start (bpRangeHi+bpRangeLo)
    f32[o + COVERAGE_FIELD.position] = ds.positions[i]!
    f32[o + COVERAGE_FIELD.minDepth] = ds.mins[i]!
    f32[o + COVERAGE_FIELD.maxDepth] = ds.maxs[i]!
  }

  return { buffer, binCount: ds.count }
}

export interface BlockSnpUploadData {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack SNP coverage segments for GPU upload.
// Positions are absolute genome coordinates from the worker.
export function packSnpCoverageForGpu(
  snpPositions: Uint32Array,
  snpYOffsets: Float32Array,
  snpHeights: Float32Array,
  snpColorTypes: Uint8Array,
  snpCount: number,
): BlockSnpUploadData {
  return packSnpSegmentsForGpu(
    snpPositions,
    snpYOffsets,
    snpHeights,
    snpColorTypes,
    snpCount,
  )
}

export interface BlockIndicatorUploadData {
  buffer: ArrayBuffer
  indicatorCount: number
}

export function packIndicatorsForGpu(
  indicatorPositions: Uint32Array,
  numIndicators: number,
): BlockIndicatorUploadData {
  if (numIndicators === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }

  const buffer = new ArrayBuffer(numIndicators * INDICATOR_STRIDE_BYTES)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < numIndicators; i++) {
    f32[i] = indicatorPositions[i]!
  }

  return { buffer, indicatorCount: numIndicators }
}

export { INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE } from './shaders/multiSyntenyFill.generated.ts'

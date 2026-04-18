import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import {
  arcColorPalette,
  arcLineColorPalette,
} from './shaders/palettes.ts'
import * as arcShader from './shaders/slang/arc.generated.ts'
import * as arcLineShader from './shaders/slang/arcLine.generated.ts'
import * as clipShader from './shaders/slang/clip.generated.ts'
import * as connectingLineShader from './shaders/slang/connectingLine.generated.ts'
import * as coverageShader from './shaders/slang/coverage.generated.ts'
import * as flatQuadShader from './shaders/slang/flatQuad.generated.ts'
import * as gapShader from './shaders/slang/gap.generated.ts'
import * as indicatorShader from './shaders/slang/indicator.generated.ts'
import * as insertionShader from './shaders/slang/insertion.generated.ts'
import * as mismatchShader from './shaders/slang/mismatch.generated.ts'
import * as modCoverageShader from './shaders/slang/modCoverage.generated.ts'
import * as modificationShader from './shaders/slang/modification.generated.ts'
import * as noncovShader from './shaders/slang/noncovHistogram.generated.ts'
import * as readShader from './shaders/slang/read.generated.ts'
import * as snpCoverageShader from './shaders/slang/snpCoverage.generated.ts'

import type {
  AlignmentsBackend,
  ArcsUploadData,
  CigarUploadData,
  ColorPalette,
  ConnectingLinesUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ModificationUploadData,
  RGBColor,
  ReadUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

// Shader strides — every pass shares the same Uniforms struct (see
// shaders/slang/alignmentsUniforms.slang) so we use any module's
// UNIFORMS_SIZE_BYTES. Keep one shared ArrayBuffer for the UBO.
const UNIFORMS_SIZE_BYTES = readShader.UNIFORMS_SIZE_BYTES
const U = readShader.UNIFORM_OFFSET_F32

// Pass IDs
const PASS_READ = 'read'
const PASS_GAP = 'gap'
const PASS_MISMATCH = 'mismatch'
const PASS_INSERTION = 'insertion'
const PASS_CLIP = 'clip'           // unified soft+hard clip bars
const PASS_MOD = 'modification'
const PASS_COVERAGE = 'coverage'
const PASS_SNP_COV = 'snpCov'
const PASS_MOD_COV = 'modCov'
const PASS_NONCOV = 'noncov'
const PASS_INDICATOR = 'indicator'
const PASS_ARC = 'arc'
const PASS_ARC_LINE = 'arcLine'
const PASS_CONN_LINE = 'connLine'
const PASS_FLAT_QUAD = 'flatQuad'
const PASS_SOFTCLIP_BASES = 'softclipBases'

const CLIP_KIND_SOFT = 0
const CLIP_KIND_HARD = 1

// Constant slot lookups hoisted so the hot path doesn't rebuild arrays.
const ARC_COLOR_SLOTS = [
  U.arcColor0, U.arcColor1, U.arcColor2, U.arcColor3,
  U.arcColor4, U.arcColor5, U.arcColor6, U.arcColor7,
] as const
const ARC_LINE_SLOTS = [U.arcLineColor0, U.arcLineColor1] as const

// Pack every palette color into the UBO as u32 ABGR. Pure — writes through
// the given u32 view only, no rendering side effects.
function writePaletteToUbo(u: Uint32Array, c: ColorPalette) {
  const pack = (rgb: RGBColor) => normalizedRgbToABGR(rgb[0], rgb[1], rgb[2])
  u[U.colorFwd] = pack(c.colorFwdStrand)
  u[U.colorRev] = pack(c.colorRevStrand)
  u[U.colorNostrand] = pack(c.colorNostrand)
  u[U.colorPairLR] = pack(c.colorPairLR)
  u[U.colorPairRL] = pack(c.colorPairRL)
  u[U.colorPairRR] = pack(c.colorPairRR)
  u[U.colorPairLL] = pack(c.colorPairLL)
  u[U.colorBaseA] = pack(c.colorBaseA)
  u[U.colorBaseC] = pack(c.colorBaseC)
  u[U.colorBaseG] = pack(c.colorBaseG)
  u[U.colorBaseT] = pack(c.colorBaseT)
  u[U.colorInsertion] = pack(c.colorInsertion)
  u[U.colorDeletion] = pack(c.colorDeletion)
  u[U.colorSkip] = pack(c.colorSkip)
  u[U.colorSoftclip] = pack(c.colorSoftclip)
  u[U.colorHardclip] = pack(c.colorHardclip)
  u[U.colorCoverage] = pack(c.colorCoverage)
  u[U.colorModFwd] = pack(c.colorModificationFwd)
  u[U.colorModRev] = pack(c.colorModificationRev)
  u[U.colorLongInsert] = pack(c.colorLongInsert)
  u[U.colorShortInsert] = pack(c.colorShortInsert)
  u[U.colorSupplementary] = pack(c.colorSupplementary)
  u[U.colorUnmappedMate] = pack(c.colorUnmappedMate)
  for (let i = 0; i < arcColorPalette.length; i++) {
    u[ARC_COLOR_SLOTS[i]!] = pack(arcColorPalette[i]!)
  }
  for (let i = 0; i < arcLineColorPalette.length; i++) {
    u[ARC_LINE_SLOTS[i]!] = pack(arcLineColorPalette[i]!)
  }
}

const ARC_CURVE_SEGMENTS = 64

export const ALIGNMENTS_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_READ, mod: readShader, verticesPerInstance: 9 }),
  slangPass({ id: PASS_GAP, mod: gapShader, verticesPerInstance: 6 }),
  slangPass({ id: PASS_MISMATCH, mod: mismatchShader, verticesPerInstance: 6 }),
  slangPass({
    id: PASS_INSERTION,
    mod: insertionShader,
    verticesPerInstance: 18,
  }),
  slangPass({ id: PASS_CLIP, mod: clipShader, verticesPerInstance: 6 }),
  slangPass({ id: PASS_MOD, mod: modificationShader, verticesPerInstance: 6 }),
  slangPass({ id: PASS_COVERAGE, mod: coverageShader, verticesPerInstance: 6 }),
  slangPass({
    id: PASS_SNP_COV,
    mod: snpCoverageShader,
    verticesPerInstance: 6,
  }),
  slangPass({
    id: PASS_MOD_COV,
    mod: modCoverageShader,
    verticesPerInstance: 6,
  }),
  slangPass({ id: PASS_NONCOV, mod: noncovShader, verticesPerInstance: 6 }),
  slangPass({
    id: PASS_INDICATOR,
    mod: indicatorShader,
    verticesPerInstance: 3,
  }),
  slangPass({
    id: PASS_ARC,
    mod: arcShader,
    verticesPerInstance: (ARC_CURVE_SEGMENTS + 1) * 2,
    topology: 'triangle-strip',
  }),
  slangPass({
    id: PASS_ARC_LINE,
    mod: arcLineShader,
    verticesPerInstance: 2,
    topology: 'line-list',
  }),
  slangPass({
    id: PASS_CONN_LINE,
    mod: connectingLineShader,
    verticesPerInstance: 6,
  }),
  // Softclip-base bases reuse the mismatch pass geometry + colors.
  slangPass({
    id: PASS_SOFTCLIP_BASES,
    mod: mismatchShader,
    verticesPerInstance: 6,
  }),
  slangPass({ id: PASS_FLAT_QUAD, mod: flatQuadShader, verticesPerInstance: 6 }),
]

export { UNIFORMS_SIZE_BYTES }

// Per-block inputs collected before each writeUniforms call. Keeping them
// in one record avoids a 10-arg method signature and lets downstream
// overlay passes refer to the same frame without recomputation.
interface BlockFrame {
  region: LocalRegion
  bpHi: number
  bpLo: number
  clippedBpStart: number
  clippedBpEnd: number
  canvasW: number
  reversed: boolean
}

// Per-region data not tracked by the HAL
interface LocalRegion {
  regionStart: number
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  insertSizeStats?: { upper: number; lower: number }
  maxDepth: number
  binSize: number
  noncovMaxCount: number
}

const OVERLAY_REGION = 999999

export class GpuAlignmentsRenderer implements AlignmentsBackend {
  private hal: GpuHal
  private uData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uF32 = new Float32Array(this.uData)
  private uU32 = new Uint32Array(this.uData)
  private uI32 = new Int32Array(this.uData)
  private regions = new Map<number, LocalRegion>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  private emptyRegion(regionStart: number): LocalRegion {
    return {
      regionStart,
      readIdToIndex: new Map(),
      readPositions: new Uint32Array(0),
      readYs: new Uint16Array(0),
      readStrands: new Int8Array(0),
      maxDepth: 0,
      binSize: 1,
      noncovMaxCount: 0,
    }
  }

  uploadRegion(regionNumber: number, data: PileupDataResult) {
    this.uploadFromTypedArraysForRegion(regionNumber, data)
    this.uploadCigarFromTypedArraysForRegion(regionNumber, data)
    this.uploadModificationsFromTypedArraysForRegion(regionNumber, data)
    this.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
    this.uploadModCoverageFromTypedArraysForRegion(regionNumber, data)
  }

  uploadFromTypedArraysForRegion(regionNumber: number, data: ReadUploadData) {
    this.hal.deleteRegion(regionNumber)
    const r = this.emptyRegion(data.regionStart)
    r.insertSizeStats = data.insertSizeStats
    r.readPositions = data.readPositions
    r.readYs = data.readYs
    r.readStrands = data.readStrands
    for (let i = 0; i < data.numReads; i++) {
      r.readIdToIndex.set(data.readIds[i]!, i)
    }
    this.regions.set(regionNumber, r)
    this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })

    if (data.numSegments > 0) {
      const n = data.numSegments
      const stride32 = readShader.INSTANCE_STRIDE_F32
      const F = readShader.FIELD_OFFSET_F32
      const hasTagColors = data.readTagColors.length > 0
      const buf = new ArrayBuffer(n * readShader.INSTANCE_STRIDE_BYTES)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      const i32 = new Int32Array(buf)
      for (let j = 0; j < n; j++) {
        const ri = data.segmentReadIndices[j]!
        const o = j * stride32
        u32[o + F.startOff] = data.segmentPositions[j * 2]!
        u32[o + F.endOff] = data.segmentPositions[j * 2 + 1]!
        u32[o + F.y] = data.readYs[ri]!
        u32[o + F.flags] = data.readFlags[ri]!
        u32[o + F.mapq] = data.readMapqs[ri]!
        u32[o + F.baseQuality] = data.readAvgBaseQualities[ri]!
        f32[o + F.insertSize] = data.readInsertSizes[ri]!
        u32[o + F.pairOrient] = data.readPairOrientations[ri]!
        i32[o + F.strand] = data.readStrands[ri]!
        u32[o + F.tagColor] = hasTagColors ? data.readTagColors[ri]! : 0
        u32[o + F.chainHasSupp] = data.readChainHasSupp?.[ri] ?? 0
        u32[o + F.readIndex] = ri
        u32[o + F.edgeFlags] = data.segmentEdgeFlags[j]!
        u32[o + F.readStartOff] = data.readPositions[ri * 2]!
        u32[o + F.readEndOff] = data.readPositions[ri * 2 + 1]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_READ, buf, n)
    }
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: CigarUploadData,
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }

    if (data.numGaps > 0) {
      const F = gapShader.FIELD_OFFSET_F32
      const s32 = gapShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(data.numGaps * gapShader.INSTANCE_STRIDE_BYTES)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numGaps; i++) {
        const o = i * s32
        u32[o + F.startOff] = data.gapPositions[i * 2]!
        u32[o + F.endOff] = data.gapPositions[i * 2 + 1]!
        u32[o + F.y] = data.gapYs[i]!
        u32[o + F.gapType] = data.gapTypes[i]!
        f32[o + F.frequency] = data.gapFrequencies[i]! / 255
      }
      this.hal.uploadBuffer(regionNumber, PASS_GAP, buf, data.numGaps)
    }

    if (data.numMismatches > 0) {
      const F = mismatchShader.FIELD_OFFSET_F32
      const s32 = mismatchShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(
        data.numMismatches * mismatchShader.INSTANCE_STRIDE_BYTES,
      )
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numMismatches; i++) {
        const o = i * s32
        u32[o + F.position] = data.mismatchPositions[i]!
        u32[o + F.y] = data.mismatchYs[i]!
        u32[o + F.base] = data.mismatchBases[i]!
        f32[o + F.frequency] = data.mismatchFrequencies[i]! / 255
      }
      this.hal.uploadBuffer(
        regionNumber,
        PASS_MISMATCH,
        buf,
        data.numMismatches,
      )
    }

    // Interbase buffer is laid out (insertions, softclips, hardclips) by
    // the worker, so we iterate subranges directly — no per-element type
    // scan on the main thread.
    const insStart = 0
    const insEnd = data.numInsertions
    const scEnd = insEnd + data.numSoftclips
    const hcEnd = scEnd + data.numHardclips

    if (data.numInsertions > 0) {
      const F = insertionShader.FIELD_OFFSET_F32
      const s32 = insertionShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(
        data.numInsertions * insertionShader.INSTANCE_STRIDE_BYTES,
      )
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = insStart; i < insEnd; i++) {
        const o = (i - insStart) * s32
        u32[o + F.position] = data.interbasePositions[i]!
        u32[o + F.y] = data.interbaseYs[i]!
        u32[o + F.length] = data.interbaseLengths[i]!
        f32[o + F.frequency] = data.interbaseFrequencies[i]! / 255
      }
      this.hal.uploadBuffer(regionNumber, PASS_INSERTION, buf, data.numInsertions)
    }

    // Softclip + hardclip share one buffer + pass; `kind` selects the color.
    const clipCount = data.numSoftclips + data.numHardclips
    if (clipCount > 0) {
      const F = clipShader.FIELD_OFFSET_F32
      const s32 = clipShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(clipCount * clipShader.INSTANCE_STRIDE_BYTES)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = insEnd; i < hcEnd; i++) {
        const o = (i - insEnd) * s32
        u32[o + F.position] = data.interbasePositions[i]!
        u32[o + F.y] = data.interbaseYs[i]!
        u32[o + F.length] = data.interbaseLengths[i]!
        f32[o + F.frequency] = data.interbaseFrequencies[i]! / 255
        u32[o + F.kind] = i < scEnd ? CLIP_KIND_SOFT : CLIP_KIND_HARD
      }
      this.hal.uploadBuffer(regionNumber, PASS_CLIP, buf, clipCount)
    }

    if (data.numSoftclipBases > 0) {
      const F = mismatchShader.FIELD_OFFSET_F32
      const s32 = mismatchShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(
        data.numSoftclipBases * mismatchShader.INSTANCE_STRIDE_BYTES,
      )
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < data.numSoftclipBases; i++) {
        const o = i * s32
        u32[o + F.position] = data.softclipBasePositions[i]!
        u32[o + F.y] = data.softclipBaseYs[i]!
        u32[o + F.base] = data.softclipBaseBases[i]!
      }
      this.hal.uploadBuffer(
        regionNumber,
        PASS_SOFTCLIP_BASES,
        buf,
        data.numSoftclipBases,
      )
    }
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: ModificationUploadData,
  ) {
    if (data.numModifications > 0) {
      const n = data.numModifications
      const F = modificationShader.FIELD_OFFSET_F32
      const s32 = modificationShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(n * modificationShader.INSTANCE_STRIDE_BYTES)
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * s32
        u32[o + F.position] = data.modificationPositions[i]!
        u32[o + F.y] = data.modificationYs[i]!
        u32[o + F.packedColor] = data.modificationColors[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_MOD, buf, n)
    }
  }

  uploadCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: CoverageUploadData,
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      return
    }

    if (data.numCoverageBins > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_COVERAGE,
        data.coveragePackedBuffer,
        data.numCoverageBins,
      )
      r.maxDepth = data.coverageMaxDepth
      r.binSize = 1
      this.hal.setRegionMeta(regionNumber, { maxDepth: data.coverageMaxDepth })
    }

    if (data.numSnpSegments > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_SNP_COV,
        data.snpPackedBuffer,
        data.numSnpSegments,
      )
    }

    if (data.numNoncovSegments > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_NONCOV,
        data.noncovPackedBuffer,
        data.numNoncovSegments,
      )
      r.noncovMaxCount = data.noncovMaxCount
    }

    if (data.numIndicators > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_INDICATOR,
        data.indicatorPackedBuffer,
        data.numIndicators,
      )
    }
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: ModCoverageUploadData,
  ) {
    if (data.numModCovSegments > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_MOD_COV,
        data.modCovPackedBuffer,
        data.numModCovSegments,
      )
    }
  }

  uploadArcsFromTypedArraysForRegion(
    regionNumber: number,
    data: ArcsUploadData,
  ) {
    const r = this.regions.get(regionNumber)
    if (!r) {
      const nr = this.emptyRegion(data.regionStart)
      this.regions.set(regionNumber, nr)
      this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })
    }

    if (data.numArcs > 0) {
      const n = data.numArcs
      const F = arcShader.FIELD_OFFSET_F32
      const s32 = arcShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(n * arcShader.INSTANCE_STRIDE_BYTES)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * s32
        f32[o + F.x1] = data.arcX1[i]!
        f32[o + F.x2] = data.arcX2[i]!
        f32[o + F.colorType] = data.arcColorTypes[i]!
        f32[o + F.isArc] = data.arcIsArc[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_ARC, buf, n)
    }

    if (data.numLines > 0) {
      const n = data.numLines
      const F = arcLineShader.FIELD_OFFSET_F32
      const s32 = arcLineShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(n * arcLineShader.INSTANCE_STRIDE_BYTES)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * s32
        u32[o + F.position] = data.linePositions[i]!
        f32[o + F.y] = data.lineYs[i]!
        f32[o + F.colorType] = data.lineColorTypes[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_ARC_LINE, buf, n)
    }
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: ConnectingLinesUploadData,
  ) {
    if (!this.regions.has(regionNumber)) {
      const r = this.emptyRegion(data.regionStart)
      this.regions.set(regionNumber, r)
      this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })
    }
    if (data.numConnectingLines > 0) {
      const n = data.numConnectingLines
      const F = connectingLineShader.FIELD_OFFSET_F32
      const s32 = connectingLineShader.INSTANCE_STRIDE_F32
      const buf = new ArrayBuffer(
        n * connectingLineShader.INSTANCE_STRIDE_BYTES,
      )
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * s32
        u32[o + F.startOff] = data.connectingLinePositions[i * 2]!
        u32[o + F.endOff] = data.connectingLinePositions[i * 2 + 1]!
        f32[o + F.y] = data.connectingLineYs[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_CONN_LINE, buf, n)
    }
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    const { region } = frame
    const f = this.uF32
    const u = this.uU32
    const ii = this.uI32
    f[U.bpHi] = frame.bpHi
    f[U.bpLo] = frame.bpLo
    f[U.bpLen] = frame.clippedBpEnd - frame.clippedBpStart
    f[U.hpZero] = 0
    u[U.regionStart] = region.regionStart
    f[U.canvasW] = frame.canvasW
    f[U.canvasH] = state.canvasHeight
    f[U.rangeY0] = state.rangeY[0]
    f[U.scrollTop] = state.rangeY[0]
    f[U.covOffset] = state.pileupTopOffset
    f[U.featHeight] = state.featureHeight
    f[U.featSpacing] = state.featureSpacing
    f[U.covHeight] = state.coverageHeight
    f[U.covYOffset] = state.coverageYOffset
    f[U.depthScale] =
      state.coverageMaxDepth !== undefined && region.maxDepth > 0
        ? region.maxDepth / state.coverageMaxDepth
        : 1
    f[U.binSize] = region.binSize
    f[U.noncovHeight] =
      region.noncovMaxCount > 0 ? Math.min(region.noncovMaxCount * 2, 20) : 0
    f[U.domainStart] = frame.clippedBpStart - region.regionStart
    f[U.domainEnd] = frame.clippedBpEnd - region.regionStart
    f[U.insertUpper] = region.insertSizeStats?.upper ?? 999999
    f[U.insertLower] = region.insertSizeStats?.lower ?? 0
    ii[U.colorScheme] = state.colorScheme
    ii[U.highlightIdx] = -1
    ii[U.highlightOnly] = 0
    ii[U.chainMode] = state.renderingMode === 'linkedRead' ? 1 : 0
    ii[U.showStroke] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
    ii[U.flipStrandLongRead] =
      state.flipStrandLongReadChains !== false ? 1 : 0
    f[U.reversed] = frame.reversed ? 1 : 0

    writePaletteToUbo(u, state.colors)
    this.hal.writeUniforms(this.uData)
  }

  renderBlocks(blocks: RenderBlock[], state: RenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufH = Math.round(canvasHeight * dpr)
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    let hasDrawn = false
    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx =
        fullBlockWidth > 0
          ? (block.bpRangeX[1] - block.bpRangeX[0]) / fullBlockWidth
          : 1

      const pxFromEdge = block.reversed
        ? block.screenEndPx - scissorEnd
        : scissorX - block.screenStartPx
      const clippedBpStart = block.bpRangeX[0] + pxFromEdge * bpPerPx
      const clippedBpEnd = clippedBpStart + scissorW * bpPerPx
      const [bpHi, bpLo] = splitPositionWithFrac(clippedBpStart)
      const frame: BlockFrame = {
        region,
        bpHi,
        bpLo,
        clippedBpStart,
        clippedBpEnd,
        canvasW: scissorW,
        reversed: block.reversed,
      }

      this.writeUniforms(state, frame)

      const mode = state.renderingMode ?? 'pileup'
      const effectiveArcsHeight =
        state.showArcs && state.arcsHeight ? state.arcsHeight : 0
      const covH = state.showCoverage ? state.coverageHeight : 0
      const pileupTop = Math.round(state.pileupTopOffset * dpr)
      const pileupH = Math.max(0, bufH - pileupTop)

      if (effectiveArcsHeight > 0 && !state.pairedArcsDown) {
        this.drawArcsPass(
          block,
          region,
          state,
          scissorX,
          scissorW,
          0,
          dpr,
          bufH,
          effectiveArcsHeight,
          effectiveArcsHeight,
        )
      }

      const vpX = Math.round(scissorX * dpr)
      const vpW = Math.round(scissorW * dpr)
      this.hal.setViewport(vpX, 0, vpW, bufH)
      this.hal.setScissor(vpX, 0, vpW, bufH)

      if (state.showCoverage) {
        this.hal.drawPass(PASS_COVERAGE, block.regionNumber)
        this.hal.drawPass(PASS_SNP_COV, block.regionNumber)
        this.hal.drawPass(PASS_MOD_COV, block.regionNumber)
        this.hal.drawPass(PASS_NONCOV, block.regionNumber)
        this.hal.drawPass(PASS_INDICATOR, block.regionNumber)
      }

      if (pileupH > 0) {
        this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
      }

      if (mode === 'linkedRead') {
        this.hal.drawPass(PASS_CONN_LINE, block.regionNumber)
      }
      this.hal.drawPass(PASS_READ, block.regionNumber)

      if (state.showMismatches) {
        this.hal.drawPass(PASS_GAP, block.regionNumber)
        this.hal.drawPass(PASS_MISMATCH, block.regionNumber)
        this.hal.drawPass(PASS_INSERTION, block.regionNumber)
      }

      this.hal.drawPass(PASS_CLIP, block.regionNumber)
      if (state.showSoftClipping) {
        this.hal.drawPass(PASS_SOFTCLIP_BASES, block.regionNumber)
      }

      if (state.showModifications) {
        this.hal.drawPass(PASS_MOD, block.regionNumber)
      }

      this.renderFeatureOverlays(
        block,
        state,
        frame,
        scissorX,
        scissorW,
        bufH,
        pileupTop,
        pileupH,
        dpr,
      )

      if (effectiveArcsHeight > 0 && state.pairedArcsDown) {
        this.drawArcsPass(
          block,
          region,
          state,
          scissorX,
          scissorW,
          covH,
          dpr,
          bufH,
          effectiveArcsHeight,
        )
      }

      hasDrawn = true
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    this.hal.deleteRegion(OVERLAY_REGION)

    if (!hasDrawn) {
      this.hal.beginFrame(0, 0, 0, 0)
      this.hal.endFrame()
    }
  }

  private writeBlockUniforms(
    r: LocalRegion,
    block: {
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    },
    vpX: number,
    vpW: number,
  ) {
    const blockW = block.screenEndPx - block.screenStartPx
    const [hi, lo] = splitPositionWithFrac(block.bpRangeX[0])
    this.uF32[U.canvasW] = vpW
    this.uF32[U.blockStartPx] = block.screenStartPx - vpX
    this.uF32[U.blockWidth] = blockW
    this.uF32[U.bpHi] = hi
    this.uF32[U.bpLo] = lo
    this.uF32[U.bpLen] = block.bpRangeX[1] - block.bpRangeX[0]
    this.uF32[U.domainStart] = block.bpRangeX[0] - r.regionStart
    this.uF32[U.domainEnd] = block.bpRangeX[1] - r.regionStart
    this.uU32[U.regionStart] = r.regionStart
  }

  private drawArcsPass(
    block: RenderBlock,
    region: LocalRegion,
    state: RenderState,
    scissorX: number,
    scissorW: number,
    arcTop: number,
    dpr: number,
    bufH: number,
    effectiveArcsHeight: number,
    arcHeightForOffset?: number,
  ) {
    const arcViewportTop = Math.round(arcTop * dpr)
    const arcViewportH = Math.min(
      Math.round(effectiveArcsHeight * dpr),
      Math.max(0, bufH - arcViewportTop),
    )
    if (arcViewportH > 0) {
      this.uF32[U.covOffset] = arcHeightForOffset ?? 0
      this.uF32[U.canvasH] = arcViewportH / dpr
      this.writeBlockUniforms(region, block, scissorX, scissorW)
      this.uF32[U.lineWidthPx] = state.arcLineWidth ?? 1
      this.uF32[U.pairedArcsDown] = state.pairedArcsDown ? 1 : 0
      this.hal.writeUniforms(this.uData)

      const vpX = Math.round(scissorX * dpr)
      const vpW = Math.round(scissorW * dpr)
      this.hal.setViewport(vpX, arcViewportTop, vpW, arcViewportH)
      this.hal.setScissor(vpX, arcViewportTop, vpW, arcViewportH)

      this.hal.drawPass(PASS_ARC, block.regionNumber)
      this.hal.drawPass(PASS_ARC_LINE, block.regionNumber)

      this.uF32[U.covOffset] = state.pileupTopOffset
      this.uF32[U.canvasH] = state.canvasHeight
      this.hal.writeUniforms(this.uData)
    }
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    state: RenderState,
    frame: BlockFrame,
    scissorX: number,
    scissorW: number,
    bufH: number,
    pileupTop: number,
    pileupH: number,
    dpr: number,
  ) {
    const { region } = frame
    const { bpHi, bpLo } = frame
    const bpLen = frame.clippedBpEnd - frame.clippedBpStart
    const regionHighlightIdx = state.highlightedFeatureId
      ? (region.readIdToIndex.get(state.highlightedFeatureId) ?? -1)
      : -1
    const regionSelectIdx = state.selectedFeatureId
      ? (region.readIdToIndex.get(state.selectedFeatureId) ?? -1)
      : -1

    const needsFeatureHighlight =
      state.highlightedChainIds.length === 0 && regionHighlightIdx >= 0
    const needsFeatureSelection =
      state.selectedChainIds.length === 0 && regionSelectIdx >= 0

    const covOff = state.pileupTopOffset
    // Capture per-block transforms so the 3 toClipRect call sites below
    // don't each have to repeat the same 7 uniform-derived args.
    const clipFor = (absStart: number, absEnd: number, y: number) =>
      toClipRect(
        absStart,
        absEnd,
        y,
        state,
        bpHi,
        bpLo,
        bpLen,
        covOff,
        state.canvasHeight,
        block.reversed,
      )
    const tx = 4 / scissorW
    const ty = 4 / state.canvasHeight
    // 4 quads forming a 4px-wide selection frame (top + bottom + two sides).
    const pushSelectionFrame = (
      out: number[],
      c: { sx1: number; sx2: number; syTop: number; syBot: number },
    ) => {
      out.push(
        c.sx1, c.syTop, c.sx2, c.syTop - ty,         0, 0.722, 1, 1,
        c.sx1, c.syBot + ty, c.sx2, c.syBot,         0, 0.722, 1, 1,
        c.sx1, c.syTop, c.sx1 + tx, c.syBot,         0, 0.722, 1, 1,
        c.sx2 - tx, c.syTop, c.sx2, c.syBot,         0, 0.722, 1, 1,
      )
    }

    if (
      (needsFeatureHighlight || needsFeatureSelection) &&
      this.hal.getBufferCount(block.regionNumber, PASS_READ) > 0
    ) {
      if (needsFeatureHighlight) {
        this.uI32[U.highlightOnly] = 1
        this.uI32[U.highlightIdx] = regionHighlightIdx
        this.hal.writeUniforms(this.uData)

        const vpX = Math.round(scissorX * dpr)
        const vpW = Math.round(scissorW * dpr)
        this.hal.setViewport(vpX, 0, vpW, bufH)
        this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
        this.hal.drawPass(PASS_READ, block.regionNumber)

        this.uI32[U.highlightOnly] = 0
        this.hal.writeUniforms(this.uData)
      }

      if (needsFeatureSelection) {
        const idx = regionSelectIdx
        const clip = clipFor(
          region.readPositions[idx * 2]! + region.regionStart,
          region.readPositions[idx * 2 + 1]! + region.regionStart,
          region.readYs[idx]!,
        )
        const frame: number[] = []
        pushSelectionFrame(frame, clip)
        this.drawOverlayQuads(
          new Float32Array(frame),
          4,
          scissorX,
          scissorW,
          pileupTop,
          pileupH,
          bufH,
          dpr,
        )
      }
    }

    const quads: number[] = []

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const clip = clipFor(
          bounds.minStart + region.regionStart,
          bounds.maxEnd + region.regionStart,
          bounds.y,
        )
        quads.push(clip.sx1, clip.syTop, clip.sx2, clip.syBot, 0, 0, 0, 0.4)
      }
    }

    if (state.selectedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.selectedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        pushSelectionFrame(
          quads,
          clipFor(
            bounds.minStart + region.regionStart,
            bounds.maxEnd + region.regionStart,
            bounds.y,
          ),
        )
      }
    }

    if (quads.length > 0) {
      this.drawOverlayQuads(
        new Float32Array(quads),
        quads.length / 8,
        scissorX,
        scissorW,
        pileupTop,
        pileupH,
        bufH,
        dpr,
      )
    }
  }

  private drawOverlayQuads(
    quads: Float32Array,
    count: number,
    scissorX: number,
    scissorW: number,
    pileupTop: number,
    pileupH: number,
    bufH: number,
    dpr: number,
  ) {
    this.hal.uploadBuffer(
      OVERLAY_REGION,
      PASS_FLAT_QUAD,
      quads.buffer as ArrayBuffer,
      count,
    )
    const vpX = Math.round(scissorX * dpr)
    const vpW = Math.round(scissorW * dpr)
    this.hal.setViewport(vpX, 0, vpW, bufH)
    this.hal.setScissor(vpX, pileupTop, vpW, pileupH)
    this.hal.drawPass(PASS_FLAT_QUAD, OVERLAY_REGION)
  }

  dispose() {
    for (const key of this.regions.keys()) {
      this.hal.deleteRegion(key)
    }
    this.regions.clear()
    this.hal.dispose()
  }
}

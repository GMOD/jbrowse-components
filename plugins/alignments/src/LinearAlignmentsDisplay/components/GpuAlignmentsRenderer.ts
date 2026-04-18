import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'
import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import { arcColorPalette, arcLineColorPalette } from './shaders/palettes.ts'
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
const PASS_CLIP = 'clip' // unified soft+hard clip bars
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
  U.arcColor0,
  U.arcColor1,
  U.arcColor2,
  U.arcColor3,
  U.arcColor4,
  U.arcColor5,
  U.arcColor6,
  U.arcColor7,
] as const
const ARC_LINE_SLOTS = [U.arcLineColor0, U.arcLineColor1] as const

// Fill the per-frame UBO slots. Pure — mutates only the given typed-array
// views. Every field here corresponds to a `u.fieldName` in
// alignmentsUniforms.slang; adding a new field means updating both.
function fillFrameUniforms(
  f: Float32Array,
  u: Uint32Array,
  i: Int32Array,
  state: RenderState,
  frame: BlockFrame,
) {
  const { region } = frame
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
  i[U.colorScheme] = state.colorScheme
  i[U.highlightIdx] = -1
  i[U.highlightOnly] = 0
  i[U.chainMode] = state.renderingMode === 'linkedRead' ? 1 : 0
  i[U.showStroke] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
  i[U.flipStrandLongRead] = state.flipStrandLongReadChains !== false ? 1 : 0
  f[U.reversed] = frame.reversed ? 1 : 0
}

// ---------------------------------------------------------------------------
// Pure buffer-pack helpers. Each takes an RPC payload and returns a ready-to-
// upload ArrayBuffer matching the corresponding Slang shader's instance
// layout. They live outside the renderer class because they touch no HAL
// state — and all performance-sensitive inner loops hoist the host-object
// property accesses to locals so V8 reads through typed-array views directly.
// ---------------------------------------------------------------------------

function packReadSegments(data: ReadUploadData): ArrayBuffer {
  const n = data.numSegments
  const stride32 = readShader.INSTANCE_STRIDE_F32
  const F = readShader.FIELD_OFFSET_F32
  const buf = new ArrayBuffer(n * readShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const i32 = new Int32Array(buf)
  const tagColors = data.readTagColors
  const hasTagColors = tagColors.length > 0
  const chainHasSupp = data.readChainHasSupp
  const readPositions = data.readPositions
  const readYs = data.readYs
  const readFlags = data.readFlags
  const readMapqs = data.readMapqs
  const readAvgBaseQualities = data.readAvgBaseQualities
  const readInsertSizes = data.readInsertSizes
  const readPairOrientations = data.readPairOrientations
  const readStrands = data.readStrands
  const segmentPositions = data.segmentPositions
  const segmentReadIndices = data.segmentReadIndices
  const segmentEdgeFlags = data.segmentEdgeFlags
  for (let j = 0; j < n; j++) {
    const ri = segmentReadIndices[j]!
    const o = j * stride32
    u32[o + F.startOff] = segmentPositions[j * 2]!
    u32[o + F.endOff] = segmentPositions[j * 2 + 1]!
    u32[o + F.y] = readYs[ri]!
    u32[o + F.flags] = readFlags[ri]!
    u32[o + F.mapq] = readMapqs[ri]!
    u32[o + F.baseQuality] = readAvgBaseQualities[ri]!
    f32[o + F.insertSize] = readInsertSizes[ri]!
    u32[o + F.pairOrient] = readPairOrientations[ri]!
    i32[o + F.strand] = readStrands[ri]!
    u32[o + F.tagColor] = hasTagColors ? tagColors[ri]! : 0
    u32[o + F.chainHasSupp] = chainHasSupp ? chainHasSupp[ri]! : 0
    u32[o + F.readIndex] = ri
    u32[o + F.edgeFlags] = segmentEdgeFlags[j]!
    u32[o + F.readStartOff] = readPositions[ri * 2]!
    u32[o + F.readEndOff] = readPositions[ri * 2 + 1]!
  }
  return buf
}

function packGaps(data: CigarUploadData): ArrayBuffer {
  const n = data.numGaps
  const F = gapShader.FIELD_OFFSET_F32
  const s32 = gapShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * gapShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.gapPositions
  const ys = data.gapYs
  const types = data.gapTypes
  const freq = data.gapFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.startOff] = pos[i * 2]!
    u32[o + F.endOff] = pos[i * 2 + 1]!
    u32[o + F.y] = ys[i]!
    u32[o + F.gapType] = types[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}

function packMismatches(data: CigarUploadData): ArrayBuffer {
  const n = data.numMismatches
  const F = mismatchShader.FIELD_OFFSET_F32
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.mismatchPositions
  const ys = data.mismatchYs
  const bases = data.mismatchBases
  const freq = data.mismatchFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}

function packInsertions(data: CigarUploadData): ArrayBuffer {
  const n = data.numInsertions
  const F = insertionShader.FIELD_OFFSET_F32
  const s32 = insertionShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * insertionShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.interbasePositions
  const ys = data.interbaseYs
  const lens = data.interbaseLengths
  const freq = data.interbaseFrequencies
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.length] = lens[i]!
    f32[o + F.frequency] = freq[i]! / 255
  }
  return buf
}

// Worker lays out interbases as (insertions, softclips, hardclips); pack
// soft+hard into a single clip pass with a per-instance `kind` tag.
function packClips(data: CigarUploadData): ArrayBuffer {
  const insEnd = data.numInsertions
  const scEnd = insEnd + data.numSoftclips
  const hcEnd = scEnd + data.numHardclips
  const count = data.numSoftclips + data.numHardclips
  const F = clipShader.FIELD_OFFSET_F32
  const s32 = clipShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(count * clipShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.interbasePositions
  const ys = data.interbaseYs
  const lens = data.interbaseLengths
  const freq = data.interbaseFrequencies
  for (let i = insEnd; i < hcEnd; i++) {
    const o = (i - insEnd) * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.length] = lens[i]!
    f32[o + F.frequency] = freq[i]! / 255
    u32[o + F.kind] = i < scEnd ? CLIP_KIND_SOFT : CLIP_KIND_HARD
  }
  return buf
}

// Softclip-base bases reuse the mismatch pass's geometry. Their frequency
// slot stays 0 (bases are always fully opaque at this zoom).
function packSoftclipBases(data: CigarUploadData): ArrayBuffer {
  const n = data.numSoftclipBases
  const F = mismatchShader.FIELD_OFFSET_F32
  const s32 = mismatchShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * mismatchShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const pos = data.softclipBasePositions
  const ys = data.softclipBaseYs
  const bases = data.softclipBaseBases
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.base] = bases[i]!
  }
  return buf
}

function packArcs(data: ArcsUploadData): ArrayBuffer {
  const n = data.numArcs
  const F = arcShader.FIELD_OFFSET_F32
  const s32 = arcShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * arcShader.INSTANCE_STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  const x1 = data.arcX1
  const x2 = data.arcX2
  const cts = data.arcColorTypes
  const isArc = data.arcIsArc
  for (let i = 0; i < n; i++) {
    const o = i * s32
    f32[o + F.x1] = x1[i]!
    f32[o + F.x2] = x2[i]!
    f32[o + F.colorType] = cts[i]!
    f32[o + F.isArc] = isArc[i]!
  }
  return buf
}

function packArcLines(data: ArcsUploadData): ArrayBuffer {
  const n = data.numLines
  const F = arcLineShader.FIELD_OFFSET_F32
  const s32 = arcLineShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * arcLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.linePositions
  const ys = data.lineYs
  const cts = data.lineColorTypes
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    f32[o + F.y] = ys[i]!
    f32[o + F.colorType] = cts[i]!
  }
  return buf
}

function packConnectingLines(data: ConnectingLinesUploadData): ArrayBuffer {
  const n = data.numConnectingLines
  const F = connectingLineShader.FIELD_OFFSET_F32
  const s32 = connectingLineShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * connectingLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.connectingLinePositions
  const ys = data.connectingLineYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.startOff] = pos[i * 2]!
    u32[o + F.endOff] = pos[i * 2 + 1]!
    f32[o + F.y] = ys[i]!
  }
  return buf
}

function packModifications(data: ModificationUploadData): ArrayBuffer {
  const n = data.numModifications
  const F = modificationShader.FIELD_OFFSET_F32
  const s32 = modificationShader.INSTANCE_STRIDE_F32
  const buf = new ArrayBuffer(n * modificationShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const pos = data.modificationPositions
  const ys = data.modificationYs
  const colors = data.modificationColors
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F.position] = pos[i]!
    u32[o + F.y] = ys[i]!
    u32[o + F.packedColor] = colors[i]!
  }
  return buf
}

// Arc-pass UBO patch. The arc shader reads the same UBO as the read pass
// but in a different viewport (above/below pileup), so we overwrite the
// viewport-sensitive slots before the draw. Pure — mutates only the views.
interface ArcFrame {
  region: LocalRegion
  block: RenderBlock
  state: RenderState
  scissorX: number
  scissorW: number
  arcViewportH: number
  dpr: number
  covOffset: number
}
function fillArcUniforms(f: Float32Array, u: Uint32Array, a: ArcFrame) {
  const { region, block, state, scissorX, scissorW, arcViewportH, dpr } = a
  const blockW = block.screenEndPx - block.screenStartPx
  const [hi, lo] = splitPositionWithFrac(block.bpRangeX[0])
  f[U.covOffset] = a.covOffset
  f[U.canvasH] = arcViewportH / dpr
  f[U.canvasW] = scissorW
  f[U.blockStartPx] = block.screenStartPx - scissorX
  f[U.blockWidth] = blockW
  f[U.bpHi] = hi
  f[U.bpLo] = lo
  f[U.bpLen] = block.bpRangeX[1] - block.bpRangeX[0]
  f[U.domainStart] = block.bpRangeX[0] - region.regionStart
  f[U.domainEnd] = block.bpRangeX[1] - region.regionStart
  u[U.regionStart] = region.regionStart
  f[U.lineWidthPx] = state.arcLineWidth ?? 1
  f[U.pairedArcsDown] = state.pairedArcsDown ? 1 : 0
}

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
  slangPass({
    id: PASS_FLAT_QUAD,
    mod: flatQuadShader,
    verticesPerInstance: 6,
  }),
]

export { UNIFORMS_SIZE_BYTES }

// Pure LocalRegion constructor — empty placeholders for typed arrays the
// read/coverage uploads later overwrite.
function emptyRegion(regionStart: number): LocalRegion {
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

  uploadRegion(regionNumber: number, data: PileupDataResult) {
    this.uploadFromTypedArraysForRegion(regionNumber, data)
    this.uploadCigarFromTypedArraysForRegion(regionNumber, data)
    this.uploadModificationsFromTypedArraysForRegion(regionNumber, data)
    this.uploadCoverageFromTypedArraysForRegion(regionNumber, data)
    this.uploadModCoverageFromTypedArraysForRegion(regionNumber, data)
  }

  uploadFromTypedArraysForRegion(regionNumber: number, data: ReadUploadData) {
    this.hal.deleteRegion(regionNumber)
    const r = emptyRegion(data.regionStart)
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
      this.hal.uploadBuffer(
        regionNumber,
        PASS_READ,
        packReadSegments(data),
        data.numSegments,
      )
    }
  }

  uploadCigarFromTypedArraysForRegion(
    regionNumber: number,
    data: CigarUploadData,
  ) {
    if (!this.regions.has(regionNumber)) {
      return
    }
    if (data.numGaps > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_GAP,
        packGaps(data),
        data.numGaps,
      )
    }
    if (data.numMismatches > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_MISMATCH,
        packMismatches(data),
        data.numMismatches,
      )
    }
    if (data.numInsertions > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_INSERTION,
        packInsertions(data),
        data.numInsertions,
      )
    }
    const clipCount = data.numSoftclips + data.numHardclips
    if (clipCount > 0) {
      this.hal.uploadBuffer(regionNumber, PASS_CLIP, packClips(data), clipCount)
    }
    if (data.numSoftclipBases > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_SOFTCLIP_BASES,
        packSoftclipBases(data),
        data.numSoftclipBases,
      )
    }
  }

  uploadModificationsFromTypedArraysForRegion(
    regionNumber: number,
    data: ModificationUploadData,
  ) {
    if (data.numModifications > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_MOD,
        packModifications(data),
        data.numModifications,
      )
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
    // Arcs/connectingLines can arrive from their own RPC before the main
    // read upload has registered this region. Pre-register an empty
    // LocalRegion so renderBlocks draws them even without reads.
    if (!this.regions.has(regionNumber)) {
      this.regions.set(regionNumber, emptyRegion(data.regionStart))
      this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })
    }

    if (data.numArcs > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_ARC,
        packArcs(data),
        data.numArcs,
      )
    }
    if (data.numLines > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_ARC_LINE,
        packArcLines(data),
        data.numLines,
      )
    }
  }

  uploadConnectingLinesForRegion(
    regionNumber: number,
    data: ConnectingLinesUploadData,
  ) {
    if (!this.regions.has(regionNumber)) {
      this.regions.set(regionNumber, emptyRegion(data.regionStart))
      this.hal.setRegionMeta(regionNumber, { regionStart: data.regionStart })
    }
    if (data.numConnectingLines > 0) {
      this.hal.uploadBuffer(
        regionNumber,
        PASS_CONN_LINE,
        packConnectingLines(data),
        data.numConnectingLines,
      )
    }
  }

  private writeUniforms(state: RenderState, frame: BlockFrame) {
    fillFrameUniforms(this.uF32, this.uU32, this.uI32, state, frame)
    writePaletteToUbo(this.uU32, state.colors)
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
    if (arcViewportH <= 0) {
      return
    }
    // Swap the UBO to arc-strip viewport metrics, draw the two arc passes,
    // then restore pileup-area metrics so the next block's reads use them.
    fillArcUniforms(this.uF32, this.uU32, {
      region,
      block,
      state,
      scissorX,
      scissorW,
      arcViewportH,
      dpr,
      covOffset: arcHeightForOffset ?? 0,
    })
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
        c.sx1,
        c.syTop,
        c.sx2,
        c.syTop - ty,
        0,
        0.722,
        1,
        1,
        c.sx1,
        c.syBot + ty,
        c.sx2,
        c.syBot,
        0,
        0.722,
        1,
        1,
        c.sx1,
        c.syTop,
        c.sx1 + tx,
        c.syBot,
        0,
        0.722,
        1,
        1,
        c.sx2 - tx,
        c.syTop,
        c.sx2,
        c.syBot,
        0,
        0.722,
        1,
        1,
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

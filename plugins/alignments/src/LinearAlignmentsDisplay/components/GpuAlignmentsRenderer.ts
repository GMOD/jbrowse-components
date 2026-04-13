import {
  YSCALEBAR_LABEL_OFFSET,
  packIndicatorsForGpu,
  packNoncovSegmentsForGpu,
  packSnpSegmentsForGpu,
} from '@jbrowse/alignments-core'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import { splitInterbasesByType } from './alignmentComponentUtils.ts'
import { getChainBounds, toClipRect } from './chainOverlayUtils.ts'
import {
  ARC_FRAGMENT_SHADER,
  ARC_LINE_FRAGMENT_SHADER,
  ARC_LINE_VERTEX_SHADER,
  ARC_VERTEX_SHADER,
  arcColorPalette,
  arcLineColorPalette,
} from './shaders/arcShaders.ts'
import {
  GAP_FRAGMENT_SHADER,
  GAP_VERTEX_SHADER,
  HARDCLIP_FRAGMENT_SHADER,
  HARDCLIP_VERTEX_SHADER,
  INSERTION_FRAGMENT_SHADER,
  INSERTION_VERTEX_SHADER,
  MISMATCH_FRAGMENT_SHADER,
  MISMATCH_VERTEX_SHADER,
  MODIFICATION_FRAGMENT_SHADER,
  MODIFICATION_VERTEX_SHADER,
  SOFTCLIP_FRAGMENT_SHADER,
  SOFTCLIP_VERTEX_SHADER,
} from './shaders/cigarShaders.ts'
import {
  CONNECTING_LINE_FRAGMENT_SHADER,
  CONNECTING_LINE_VERTEX_SHADER,
} from './shaders/connectingLineShaders.ts'
import {
  COVERAGE_FRAGMENT_SHADER,
  COVERAGE_VERTEX_SHADER,
  INDICATOR_FRAGMENT_SHADER,
  INDICATOR_VERTEX_SHADER,
  MOD_COVERAGE_FRAGMENT_SHADER,
  MOD_COVERAGE_VERTEX_SHADER,
  NONCOV_HISTOGRAM_FRAGMENT_SHADER,
  NONCOV_HISTOGRAM_VERTEX_SHADER,
  SNP_COVERAGE_FRAGMENT_SHADER,
  SNP_COVERAGE_VERTEX_SHADER,
} from './shaders/coverageShaders.ts'
import {
  READ_FRAGMENT_SHADER,
  READ_VERTEX_SHADER,
} from './shaders/readShaders.ts'
import { GLSL_UBO_PREAMBLE } from './shaders/uboCommon.ts'
import { splitPositionWithFrac } from './shaders/utils.ts'
import {
  GAP_WGSL,
  HARDCLIP_WGSL,
  INSERTION_WGSL,
  MISMATCH_WGSL,
  MODIFICATION_WGSL,
  SOFTCLIP_WGSL,
} from './wgsl/cigarShaders.ts'
import {
  ARC_CURVE_SEGMENTS,
  ARC_LINE_STRIDE,
  ARC_STRIDE,
  CONN_LINE_STRIDE,
  COVERAGE_STRIDE,
  GAP_STRIDE,
  HARDCLIP_STRIDE,
  INDICATOR_STRIDE,
  INSERTION_STRIDE,
  MISMATCH_STRIDE,
  MODIFICATION_STRIDE,
  MOD_COV_STRIDE,
  NONCOV_STRIDE,
  READ_STRIDE,
  SNP_COV_STRIDE,
  SOFTCLIP_STRIDE,
  UNIFORM_SIZE,
  U_ARC_COLORS,
  U_ARC_LINE_COLORS,
  U_BIN_SIZE,
  U_BLOCK_START_PX,
  U_BLOCK_WIDTH,
  U_BP_HI,
  U_BP_LEN,
  U_BP_LO,
  U_CANVAS_H,
  U_CANVAS_W,
  U_CHAIN_MODE,
  U_COLOR_BASE_A,
  U_COLOR_BASE_C,
  U_COLOR_BASE_G,
  U_COLOR_BASE_T,
  U_COLOR_COVERAGE,
  U_COLOR_DELETION,
  U_COLOR_FWD,
  U_COLOR_HARDCLIP,
  U_COLOR_INSERTION,
  U_COLOR_LONG_INSERT,
  U_COLOR_MOD_FWD,
  U_COLOR_MOD_REV,
  U_COLOR_NOSTRAND,
  U_COLOR_PAIR_LL,
  U_COLOR_PAIR_LR,
  U_COLOR_PAIR_RL,
  U_COLOR_PAIR_RR,
  U_COLOR_REV,
  U_COLOR_SCHEME,
  U_COLOR_SHORT_INSERT,
  U_COLOR_SKIP,
  U_COLOR_SOFTCLIP,
  U_COLOR_SUPPLEMENTARY,
  U_COLOR_UNMAPPED_MATE,
  U_COV_HEIGHT,
  U_COV_OFFSET,
  U_COV_Y_OFFSET,
  U_DEPTH_SCALE,
  U_DOMAIN_END,
  U_DOMAIN_START,
  U_FEAT_H,
  U_FEAT_SPACING,
  U_FLIP_STRAND_LONG_READ,
  U_GRADIENT_HUE,
  U_HIGHLIGHT_IDX,
  U_HIGHLIGHT_ONLY,
  U_HP_ZERO,
  U_INSERT_LOWER,
  U_INSERT_UPPER,
  U_LINE_WIDTH_PX,
  U_NONCOV_HEIGHT,
  U_RANGE_Y0,
  U_REGION_START,
  U_REVERSED,
  U_SCROLL_TOP,
  U_SHOW_STROKE,
} from './wgsl/common.ts'
import {
  COVERAGE_WGSL,
  INDICATOR_WGSL,
  MOD_COVERAGE_WGSL,
  NONCOV_HISTOGRAM_WGSL,
  SNP_COVERAGE_WGSL,
} from './wgsl/coverageShaders.ts'
import {
  ARC_LINE_WGSL,
  ARC_WGSL,
  CONNECTING_LINE_WGSL,
  FLAT_QUAD_WGSL,
} from './wgsl/miscShaders.ts'
import { READ_WGSL } from './wgsl/readShader.ts'

import type {
  AlignmentsBackend,
  ArcsUploadData,
  CigarUploadData,
  ConnectingLinesUploadData,
  CoverageUploadData,
  ModCoverageUploadData,
  ModificationUploadData,
  ReadUploadData,
  RenderBlock,
  RenderState,
} from './rendererTypes.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

// Simple GLSL for flat quad overlay (clip-space x1,y1,x2,y2 + RGBA)
const FLAT_QUAD_VERTEX = `#version 300 es
precision highp float;
${GLSL_UBO_PREAMBLE}
in float a_sx1; in float a_syTop; in float a_sx2; in float a_syBot;
in vec4 a_color;
out vec4 v_color;
void main() {
  int vid = gl_VertexID % 6;
  float lx = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float ly = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
  gl_Position = vec4(mix(a_sx1, a_sx2, lx), mix(a_syBot, a_syTop, ly), 0.0, 1.0);
  v_color = a_color;
}
`
const FLAT_QUAD_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() { fragColor = v_color; }
`

// Pass IDs (PASS_* naming matches other HAL renderers)
const PASS_READ = 'read'
const PASS_GAP = 'gap'
const PASS_MISMATCH = 'mismatch'
const PASS_INSERTION = 'insertion'
const PASS_SOFTCLIP = 'softclip'
const PASS_HARDCLIP = 'hardclip'
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

// Helper to define float attributes
function fattr(name: string, components: number, offsetBytes: number) {
  return {
    name,
    components,
    type: 'float' as const,
    offsetBytes,
    integer: false,
  }
}
function uattr(name: string, components: number, offsetBytes: number) {
  return { name, components, type: 'uint' as const, offsetBytes, integer: true }
}

export const ALIGNMENTS_PASSES: PassDescriptor[] = [
  {
    id: PASS_READ,
    wgslSource: READ_WGSL,
    glslVertex: READ_VERTEX_SHADER,
    glslFragment: READ_FRAGMENT_SHADER,
    instanceStride: READ_STRIDE * 4,
    verticesPerInstance: 9,
    blend: true,
    glAttributes: [
      uattr('a_position', 2, 0), // posHi, posLo (uvec2)
      uattr('a_y', 1, 8),
      uattr('a_flags', 1, 12),
      uattr('a_mapq', 1, 16),
      uattr('a_baseQuality', 1, 20),
      fattr('a_insertSize', 1, 24),
      uattr('a_pairOrientation', 1, 28),
      {
        name: 'a_strand',
        components: 1,
        type: 'int' as const,
        offsetBytes: 32,
        integer: true,
      },
      fattr('a_tagColor', 3, 36),
      uattr('a_chainHasSupp', 1, 48),
      uattr('a_readIndex', 1, 52),
      uattr('a_edgeFlags', 1, 56),
      uattr('a_readSpan', 2, 60),
    ],
  },
  {
    id: PASS_GAP,
    wgslSource: GAP_WGSL,
    glslVertex: GAP_VERTEX_SHADER,
    glslFragment: GAP_FRAGMENT_SHADER,
    instanceStride: GAP_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 2, 0),
      uattr('a_y', 1, 8),
      uattr('a_type', 1, 12),
      fattr('a_frequency', 1, 16),
    ],
  },
  {
    id: PASS_MISMATCH,
    wgslSource: MISMATCH_WGSL,
    glslVertex: MISMATCH_VERTEX_SHADER,
    glslFragment: MISMATCH_FRAGMENT_SHADER,
    instanceStride: MISMATCH_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_base', 1, 8),
      fattr('a_frequency', 1, 12),
    ],
  },
  {
    id: PASS_INSERTION,
    wgslSource: INSERTION_WGSL,
    glslVertex: INSERTION_VERTEX_SHADER,
    glslFragment: INSERTION_FRAGMENT_SHADER,
    instanceStride: INSERTION_STRIDE * 4,
    verticesPerInstance: 18,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_length', 1, 8),
      fattr('a_frequency', 1, 12),
    ],
  },
  {
    id: PASS_SOFTCLIP,
    wgslSource: SOFTCLIP_WGSL,
    glslVertex: SOFTCLIP_VERTEX_SHADER,
    glslFragment: SOFTCLIP_FRAGMENT_SHADER,
    instanceStride: SOFTCLIP_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_length', 1, 8),
      fattr('a_frequency', 1, 12),
    ],
  },
  {
    id: PASS_HARDCLIP,
    wgslSource: HARDCLIP_WGSL,
    glslVertex: HARDCLIP_VERTEX_SHADER,
    glslFragment: HARDCLIP_FRAGMENT_SHADER,
    instanceStride: HARDCLIP_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_length', 1, 8),
      fattr('a_frequency', 1, 12),
    ],
  },
  {
    id: PASS_MOD,
    wgslSource: MODIFICATION_WGSL,
    glslVertex: MODIFICATION_VERTEX_SHADER,
    glslFragment: MODIFICATION_FRAGMENT_SHADER,
    instanceStride: MODIFICATION_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_packedColor', 1, 8),
    ],
  },
  {
    id: PASS_COVERAGE,
    wgslSource: COVERAGE_WGSL,
    glslVertex: COVERAGE_VERTEX_SHADER,
    glslFragment: COVERAGE_FRAGMENT_SHADER,
    instanceStride: COVERAGE_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [fattr('a_position', 1, 0), fattr('a_depth', 1, 4)],
  },
  {
    id: PASS_SNP_COV,
    wgslSource: SNP_COVERAGE_WGSL,
    glslVertex: SNP_COVERAGE_VERTEX_SHADER,
    glslFragment: SNP_COVERAGE_FRAGMENT_SHADER,
    instanceStride: SNP_COV_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      fattr('a_position', 1, 0),
      fattr('a_yOffset', 1, 4),
      fattr('a_segmentHeight', 1, 8),
      fattr('a_colorType', 1, 12),
    ],
  },
  {
    id: PASS_MOD_COV,
    wgslSource: MOD_COVERAGE_WGSL,
    glslVertex: MOD_COVERAGE_VERTEX_SHADER,
    glslFragment: MOD_COVERAGE_FRAGMENT_SHADER,
    instanceStride: MOD_COV_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      fattr('a_position', 1, 0),
      fattr('a_yOffset', 1, 4),
      fattr('a_segmentHeight', 1, 8),
      uattr('a_packedColor', 1, 12),
    ],
  },
  {
    id: PASS_NONCOV,
    wgslSource: NONCOV_HISTOGRAM_WGSL,
    glslVertex: NONCOV_HISTOGRAM_VERTEX_SHADER,
    glslFragment: NONCOV_HISTOGRAM_FRAGMENT_SHADER,
    instanceStride: NONCOV_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      fattr('a_position', 1, 0),
      fattr('a_yOffset', 1, 4),
      fattr('a_segmentHeight', 1, 8),
      fattr('a_colorType', 1, 12),
    ],
  },
  {
    id: PASS_INDICATOR,
    wgslSource: INDICATOR_WGSL,
    glslVertex: INDICATOR_VERTEX_SHADER,
    glslFragment: INDICATOR_FRAGMENT_SHADER,
    instanceStride: INDICATOR_STRIDE * 4,
    verticesPerInstance: 3,
    blend: true,
    glAttributes: [fattr('a_position', 1, 0), fattr('a_colorType', 1, 4)],
  },
  {
    id: PASS_ARC,
    wgslSource: ARC_WGSL,
    glslVertex: ARC_VERTEX_SHADER,
    glslFragment: ARC_FRAGMENT_SHADER,
    instanceStride: ARC_STRIDE * 4,
    verticesPerInstance: (ARC_CURVE_SEGMENTS + 1) * 2,
    blend: true,
    topology: 'triangle-strip',
    glAttributes: [
      fattr('a_x1', 1, 0),
      fattr('a_x2', 1, 4),
      fattr('a_colorType', 1, 8),
      fattr('a_isArc', 1, 12),
    ],
  },
  {
    id: PASS_ARC_LINE,
    wgslSource: ARC_LINE_WGSL,
    glslVertex: ARC_LINE_VERTEX_SHADER,
    glslFragment: ARC_LINE_FRAGMENT_SHADER,
    instanceStride: ARC_LINE_STRIDE * 4,
    verticesPerInstance: 2,
    blend: true,
    topology: 'line-list',
    glAttributes: [
      uattr('a_position', 1, 0),
      fattr('a_y', 1, 4),
      fattr('a_colorType', 1, 8),
    ],
  },
  {
    id: PASS_CONN_LINE,
    wgslSource: CONNECTING_LINE_WGSL,
    glslVertex: CONNECTING_LINE_VERTEX_SHADER,
    glslFragment: CONNECTING_LINE_FRAGMENT_SHADER,
    instanceStride: CONN_LINE_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [uattr('a_position', 2, 0), fattr('a_y', 1, 8)],
  },
  {
    id: PASS_SOFTCLIP_BASES,
    wgslSource: MISMATCH_WGSL,
    glslVertex: MISMATCH_VERTEX_SHADER,
    glslFragment: MISMATCH_FRAGMENT_SHADER,
    instanceStride: MISMATCH_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      uattr('a_position', 1, 0),
      uattr('a_y', 1, 4),
      uattr('a_base', 1, 8),
      fattr('a_frequency', 1, 12),
    ],
  },
  {
    id: PASS_FLAT_QUAD,
    wgslSource: FLAT_QUAD_WGSL,
    glslVertex: FLAT_QUAD_VERTEX,
    glslFragment: FLAT_QUAD_FRAGMENT,
    instanceStride: 32,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      fattr('a_sx1', 1, 0),
      fattr('a_syTop', 1, 4),
      fattr('a_sx2', 1, 8),
      fattr('a_syBot', 1, 12),
      fattr('a_color', 4, 16),
    ],
  },
]

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
  private uData = new ArrayBuffer(UNIFORM_SIZE)
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
      const hasTagColors = data.readTagColors.length > 0
      const buf = new ArrayBuffer(n * READ_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      const i32 = new Int32Array(buf)
      for (let j = 0; j < n; j++) {
        const ri = data.segmentReadIndices[j]!
        const o = j * READ_STRIDE
        u32[o] = data.segmentPositions[j * 2]!
        u32[o + 1] = data.segmentPositions[j * 2 + 1]!
        u32[o + 2] = data.readYs[ri]!
        u32[o + 3] = data.readFlags[ri]!
        u32[o + 4] = data.readMapqs[ri]!
        u32[o + 5] = data.readAvgBaseQualities[ri]!
        f32[o + 6] = data.readInsertSizes[ri]!
        u32[o + 7] = data.readPairOrientations[ri]!
        i32[o + 8] = data.readStrands[ri]!
        f32[o + 9] = hasTagColors ? data.readTagColors[ri * 3]! / 255 : 0
        f32[o + 10] = hasTagColors ? data.readTagColors[ri * 3 + 1]! / 255 : 0
        f32[o + 11] = hasTagColors ? data.readTagColors[ri * 3 + 2]! / 255 : 0
        u32[o + 12] = data.readChainHasSupp?.[ri] ?? 0
        u32[o + 13] = ri
        u32[o + 14] = data.segmentEdgeFlags[j]!
        u32[o + 15] = data.readPositions[ri * 2]!
        u32[o + 16] = data.readPositions[ri * 2 + 1]!
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
      const buf = new ArrayBuffer(data.numGaps * GAP_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numGaps; i++) {
        const o = i * GAP_STRIDE
        u32[o] = data.gapPositions[i * 2]!
        u32[o + 1] = data.gapPositions[i * 2 + 1]!
        u32[o + 2] = data.gapYs[i]!
        u32[o + 3] = data.gapTypes[i]!
        f32[o + 4] = data.gapFrequencies[i]! / 255
      }
      this.hal.uploadBuffer(regionNumber, PASS_GAP, buf, data.numGaps)
    }

    if (data.numMismatches > 0) {
      const buf = new ArrayBuffer(data.numMismatches * MISMATCH_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < data.numMismatches; i++) {
        const o = i * MISMATCH_STRIDE
        u32[o] = data.mismatchPositions[i]!
        u32[o + 1] = data.mismatchYs[i]!
        u32[o + 2] = data.mismatchBases[i]!
        f32[o + 3] = data.mismatchFrequencies[i]! / 255
      }
      this.hal.uploadBuffer(
        regionNumber,
        PASS_MISMATCH,
        buf,
        data.numMismatches,
      )
    }

    const { insIdx, scIdx, hcIdx } = splitInterbasesByType(
      data.interbaseTypes,
      data.numInterbases,
    )

    const uploadClip = (indices: number[], stride: number, passId: string) => {
      if (indices.length === 0) {
        return
      }
      const buf = new ArrayBuffer(indices.length * stride * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (const [j, index] of indices.entries()) {
        const o = j * stride
        u32[o] = data.interbasePositions[index]!
        u32[o + 1] = data.interbaseYs[index]!
        u32[o + 2] = data.interbaseLengths[index]!
        f32[o + 3] = data.interbaseFrequencies[index]! / 255
      }
      this.hal.uploadBuffer(regionNumber, passId, buf, indices.length)
    }
    uploadClip(insIdx, INSERTION_STRIDE, PASS_INSERTION)
    uploadClip(scIdx, SOFTCLIP_STRIDE, PASS_SOFTCLIP)
    uploadClip(hcIdx, HARDCLIP_STRIDE, PASS_HARDCLIP)

    if (data.numSoftclipBases > 0) {
      const buf = new ArrayBuffer(data.numSoftclipBases * MISMATCH_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < data.numSoftclipBases; i++) {
        const o = i * MISMATCH_STRIDE
        u32[o] = data.softclipBasePositions[i]!
        u32[o + 1] = data.softclipBaseYs[i]!
        u32[o + 2] = data.softclipBaseBases[i]!
      }
      // softclip bases reuse the mismatch pass
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
      const buf = new ArrayBuffer(n * MODIFICATION_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * MODIFICATION_STRIDE
        u32[o] = data.modificationPositions[i]!
        u32[o + 1] = data.modificationYs[i]!
        const ci = i * 4
        u32[o + 2] =
          data.modificationColors[ci]! |
          (data.modificationColors[ci + 1]! << 8) |
          (data.modificationColors[ci + 2]! << 16) |
          (data.modificationColors[ci + 3]! << 24)
        u32[o + 3] = 0
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
      const n = data.numCoverageBins
      const buf = new ArrayBuffer(n * COVERAGE_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * COVERAGE_STRIDE
        f32[o] = data.coverageStartOffset + i
        f32[o + 1] = (data.coverageDepths[i] ?? 0) / data.coverageMaxDepth
      }
      this.hal.uploadBuffer(regionNumber, PASS_COVERAGE, buf, n)
      r.maxDepth = data.coverageMaxDepth
      r.binSize = 1
      this.hal.setRegionMeta(regionNumber, { maxDepth: data.coverageMaxDepth })
    }

    if (data.numSnpSegments > 0) {
      const packed = packSnpSegmentsForGpu(
        data.snpPositions,
        data.snpYOffsets,
        data.snpHeights,
        data.snpColorTypes,
        data.numSnpSegments,
      )
      this.hal.uploadBuffer(
        regionNumber,
        PASS_SNP_COV,
        packed.buffer,
        packed.segmentCount,
      )
    }

    if (data.numNoncovSegments > 0) {
      const packed = packNoncovSegmentsForGpu(
        data.noncovPositions,
        data.noncovYOffsets,
        data.noncovHeights,
        data.noncovColorTypes,
        data.numNoncovSegments,
      )
      this.hal.uploadBuffer(
        regionNumber,
        PASS_NONCOV,
        packed.buffer,
        packed.segmentCount,
      )
      r.noncovMaxCount = data.noncovMaxCount
    }

    if (data.numIndicators > 0) {
      const packed = packIndicatorsForGpu(
        data.indicatorPositions,
        data.indicatorColorTypes,
        data.numIndicators,
      )
      this.hal.uploadBuffer(
        regionNumber,
        PASS_INDICATOR,
        packed.buffer,
        packed.indicatorCount,
      )
    }
  }

  uploadModCoverageFromTypedArraysForRegion(
    regionNumber: number,
    data: ModCoverageUploadData,
  ) {
    if (data.numModCovSegments > 0) {
      const n = data.numModCovSegments
      const buf = new ArrayBuffer(n * MOD_COV_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * MOD_COV_STRIDE
        f32[o] = data.modCovPositions[i]!
        f32[o + 1] = data.modCovYOffsets[i]!
        f32[o + 2] = data.modCovHeights[i]!
        const ci = i * 4
        u32[o + 3] =
          data.modCovColors[ci]! |
          (data.modCovColors[ci + 1]! << 8) |
          (data.modCovColors[ci + 2]! << 16) |
          (data.modCovColors[ci + 3]! << 24)
      }
      this.hal.uploadBuffer(regionNumber, PASS_MOD_COV, buf, n)
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
      const buf = new ArrayBuffer(n * ARC_STRIDE * 4)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * ARC_STRIDE
        f32[o] = data.arcX1[i]!
        f32[o + 1] = data.arcX2[i]!
        f32[o + 2] = data.arcColorTypes[i]!
        f32[o + 3] = data.arcIsArc[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_ARC, buf, n)
    }

    if (data.numLines > 0) {
      const n = data.numLines
      const buf = new ArrayBuffer(n * ARC_LINE_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * ARC_LINE_STRIDE
        u32[o] = data.linePositions[i]!
        f32[o + 1] = data.lineYs[i]!
        f32[o + 2] = data.lineColorTypes[i]!
        f32[o + 3] = 0
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
      const buf = new ArrayBuffer(n * CONN_LINE_STRIDE * 4)
      const u32 = new Uint32Array(buf)
      const f32 = new Float32Array(buf)
      for (let i = 0; i < n; i++) {
        const o = i * CONN_LINE_STRIDE
        u32[o] = data.connectingLinePositions[i * 2]!
        u32[o + 1] = data.connectingLinePositions[i * 2 + 1]!
        f32[o + 2] = data.connectingLineYs[i]!
      }
      this.hal.uploadBuffer(regionNumber, PASS_CONN_LINE, buf, n)
    }
  }

  private writeColor(slot: number, c: [number, number, number]) {
    this.uF32[slot] = c[0]
    this.uF32[slot + 1] = c[1]
    this.uF32[slot + 2] = c[2]
  }

  private writeUniforms(
    state: RenderState,
    bpHi: number,
    bpLo: number,
    bpLen: number,
    regionStart: number,
    canvasW: number,
    region: LocalRegion,
    clippedBpStart: number,
    clippedBpEnd: number,
    reversed: boolean,
  ) {
    const f = this.uF32
    const u = this.uU32
    const ii = this.uI32
    f[U_BP_HI] = bpHi
    f[U_BP_LO] = bpLo
    f[U_BP_LEN] = bpLen
    u[U_REGION_START] = regionStart
    f[U_HP_ZERO] = 0
    f[U_DOMAIN_START] = clippedBpStart - regionStart
    f[U_DOMAIN_END] = clippedBpEnd - regionStart
    f[U_RANGE_Y0] = state.rangeY[0]
    f[U_CANVAS_H] = state.canvasHeight
    f[U_CANVAS_W] = canvasW
    f[U_COV_OFFSET] = state.pileupTopOffset
    f[U_FEAT_H] = state.featureHeight
    f[U_FEAT_SPACING] = state.featureSpacing
    ii[U_COLOR_SCHEME] = state.colorScheme
    ii[U_HIGHLIGHT_IDX] = -1
    ii[U_HIGHLIGHT_ONLY] = 0
    ii[U_CHAIN_MODE] = state.renderingMode === 'linkedRead' ? 1 : 0
    ii[U_FLIP_STRAND_LONG_READ] =
      state.flipStrandLongReadChains !== false ? 1 : 0
    ii[U_SHOW_STROKE] = state.showOutline && state.featureHeight >= 4 ? 1 : 0
    f[U_COV_HEIGHT] = state.coverageHeight
    f[U_COV_Y_OFFSET] = state.coverageYOffset
    f[U_DEPTH_SCALE] =
      state.coverageNicedMax !== undefined && region.maxDepth > 0
        ? region.maxDepth / state.coverageNicedMax
        : 1
    f[U_BIN_SIZE] = region.binSize
    f[U_NONCOV_HEIGHT] =
      region.noncovMaxCount > 0 ? Math.min(region.noncovMaxCount * 2, 20) : 0
    f[U_INSERT_UPPER] = region.insertSizeStats?.upper ?? 999999
    f[U_INSERT_LOWER] = region.insertSizeStats?.lower ?? 0
    f[U_SCROLL_TOP] = state.rangeY[0]
    f[U_REVERSED] = reversed ? 1 : 0
    const c = state.colors
    this.writeColor(U_COLOR_FWD, c.colorFwdStrand)
    this.writeColor(U_COLOR_REV, c.colorRevStrand)
    this.writeColor(U_COLOR_NOSTRAND, c.colorNostrand)
    this.writeColor(U_COLOR_PAIR_LR, c.colorPairLR)
    this.writeColor(U_COLOR_PAIR_RL, c.colorPairRL)
    this.writeColor(U_COLOR_PAIR_RR, c.colorPairRR)
    this.writeColor(U_COLOR_PAIR_LL, c.colorPairLL)
    this.writeColor(U_COLOR_BASE_A, c.colorBaseA)
    this.writeColor(U_COLOR_BASE_C, c.colorBaseC)
    this.writeColor(U_COLOR_BASE_G, c.colorBaseG)
    this.writeColor(U_COLOR_BASE_T, c.colorBaseT)
    this.writeColor(U_COLOR_INSERTION, c.colorInsertion)
    this.writeColor(U_COLOR_DELETION, c.colorDeletion)
    this.writeColor(U_COLOR_SKIP, c.colorSkip)
    this.writeColor(U_COLOR_SOFTCLIP, c.colorSoftclip)
    this.writeColor(U_COLOR_HARDCLIP, c.colorHardclip)
    this.writeColor(U_COLOR_COVERAGE, c.colorCoverage)
    this.writeColor(U_COLOR_MOD_FWD, c.colorModificationFwd)
    this.writeColor(U_COLOR_MOD_REV, c.colorModificationRev)
    this.writeColor(U_COLOR_LONG_INSERT, c.colorLongInsert)
    this.writeColor(U_COLOR_SHORT_INSERT, c.colorShortInsert)
    this.writeColor(U_COLOR_SUPPLEMENTARY, c.colorSupplementary)
    this.writeColor(U_COLOR_UNMAPPED_MATE, c.colorUnmappedMate)

    for (const [i, element] of arcColorPalette.entries()) {
      this.writeColor(U_ARC_COLORS + i * 3, element)
    }
    for (const [i, element] of arcLineColorPalette.entries()) {
      this.writeColor(U_ARC_LINE_COLORS + i * 3, element)
    }

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

      // For reversed blocks the low-bp edge is at the right of the scissor;
      // measure from screenEndPx instead of screenStartPx so the formula is
      // the same in both orientations.
      const pxFromEdge = block.reversed
        ? block.screenEndPx - scissorEnd
        : scissorX - block.screenStartPx
      const clippedBpLow = block.bpRangeX[0] + pxFromEdge * bpPerPx
      const clippedBpHigh = clippedBpLow + scissorW * bpPerPx
      const [bpHi, bpLo] = splitPositionWithFrac(clippedBpLow)
      const bpLen = clippedBpHigh - clippedBpLow

      this.writeUniforms(
        state,
        bpHi,
        bpLo,
        bpLen,
        region.regionStart,
        scissorW,
        region,
        clippedBpLow,
        clippedBpHigh,
        block.reversed,
      )

      const mode = state.renderingMode ?? 'pileup'
      const effectiveArcsHeight =
        state.showArcs && state.arcsHeight ? state.arcsHeight : 0
      const covH = state.showCoverage ? state.coverageHeight : 0
      const pileupTop = Math.round(state.pileupTopOffset * dpr)
      const pileupH = Math.max(0, bufH - pileupTop)

      // Coverage area: full-height scissor
      this.hal.setViewport(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )
      this.hal.setScissor(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )

      if (state.showCoverage) {
        this.hal.drawPass(PASS_COVERAGE, block.regionNumber)
        this.hal.drawPass(PASS_SNP_COV, block.regionNumber)
        this.hal.drawPass(PASS_MOD_COV, block.regionNumber)
        this.hal.drawPass(PASS_NONCOV, block.regionNumber)
        this.hal.drawPass(PASS_INDICATOR, block.regionNumber)
      }

      // Pileup area: clip to below coverage+arcs
      if (pileupH > 0) {
        this.hal.setScissor(
          Math.round(scissorX * dpr),
          pileupTop,
          Math.round(scissorW * dpr),
          pileupH,
        )
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

      this.hal.drawPass(PASS_SOFTCLIP, block.regionNumber)
      this.hal.drawPass(PASS_HARDCLIP, block.regionNumber)
      if (state.showSoftClipping) {
        this.hal.drawPass(PASS_SOFTCLIP_BASES, block.regionNumber)
      }

      if (state.showModifications) {
        this.hal.drawPass(PASS_MOD, block.regionNumber)
      }

      // Feature highlight/selection overlays
      this.renderFeatureOverlays(
        block,
        region,
        state,
        bpHi,
        bpLo,
        bpLen,
        scissorX,
        scissorW,
        bufH,
        pileupTop,
        pileupH,
        dpr,
      )

      // Arcs area — only rendered by GPU when pairedArcsDown; otherwise SVG overlay handles it
      if (effectiveArcsHeight > 0 && state.pairedArcsDown) {
        const covHPx = Math.round(covH * dpr)
        const yscaleOffPx = Math.round(YSCALEBAR_LABEL_OFFSET * dpr)
        const arcViewportTop = Math.max(0, covHPx - yscaleOffPx)
        const arcOverlapPx = covHPx - arcViewportTop
        const arcViewportH = Math.min(
          Math.round(effectiveArcsHeight * dpr) + arcOverlapPx,
          Math.max(0, bufH - arcViewportTop),
        )
        if (arcViewportH > 0) {
          this.uF32[U_COV_OFFSET] = 0
          this.uF32[U_CANVAS_H] = arcViewportH / dpr
          this.writeBlockUniforms(region, block, scissorX, scissorW)
          this.uF32[U_LINE_WIDTH_PX] = state.arcLineWidth ?? 1
          this.uF32[U_GRADIENT_HUE] = 0
          this.hal.writeUniforms(this.uData)

          this.hal.setViewport(
            Math.round(scissorX * dpr),
            arcViewportTop,
            Math.round(scissorW * dpr),
            arcViewportH,
          )
          this.hal.setScissor(
            Math.round(scissorX * dpr),
            arcViewportTop,
            Math.round(scissorW * dpr),
            arcViewportH,
          )
          this.hal.drawPass(PASS_ARC, block.regionNumber)
          this.hal.drawPass(PASS_ARC_LINE, block.regionNumber)

          // Restore uniforms
          this.uF32[U_COV_OFFSET] = state.pileupTopOffset
          this.uF32[U_CANVAS_H] = state.canvasHeight
          this.hal.writeUniforms(this.uData)
        }
      }

      hasDrawn = true
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    // Clean up transient overlay buffer after submission so the GPU can
    // finish reading it before it is destroyed.
    this.hal.deleteRegion(OVERLAY_REGION)

    if (!hasDrawn) {
      // Ensure canvas gets cleared even if no blocks
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
    this.uF32[U_CANVAS_W] = vpW
    this.uF32[U_BLOCK_START_PX] = block.screenStartPx - vpX
    this.uF32[U_BLOCK_WIDTH] = blockW
    this.uF32[U_BP_HI] = hi
    this.uF32[U_BP_LO] = lo
    this.uF32[U_BP_LEN] = block.bpRangeX[1] - block.bpRangeX[0]
    this.uF32[U_DOMAIN_START] = block.bpRangeX[0] - r.regionStart
    this.uF32[U_DOMAIN_END] = block.bpRangeX[1] - r.regionStart
    this.uU32[U_REGION_START] = r.regionStart
  }

  private renderFeatureOverlays(
    block: RenderBlock,
    region: LocalRegion,
    state: RenderState,
    bpHi: number,
    bpLo: number,
    bpLen: number,
    scissorX: number,
    scissorW: number,
    bufH: number,
    pileupTop: number,
    pileupH: number,
    dpr: number,
  ) {
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

    if (
      (needsFeatureHighlight || needsFeatureSelection) &&
      this.hal.getBufferCount(block.regionNumber, PASS_READ) > 0
    ) {
      if (needsFeatureHighlight) {
        this.uI32[U_HIGHLIGHT_ONLY] = 1
        this.uI32[U_HIGHLIGHT_IDX] = regionHighlightIdx
        this.hal.writeUniforms(this.uData)

        this.hal.setViewport(
          Math.round(scissorX * dpr),
          0,
          Math.round(scissorW * dpr),
          bufH,
        )
        this.hal.setScissor(
          Math.round(scissorX * dpr),
          pileupTop,
          Math.round(scissorW * dpr),
          pileupH,
        )
        this.hal.drawPass(PASS_READ, block.regionNumber)

        this.uI32[U_HIGHLIGHT_ONLY] = 0
        this.hal.writeUniforms(this.uData)
      }

      if (needsFeatureSelection) {
        const idx = regionSelectIdx
        const absStart = region.readPositions[idx * 2]! + region.regionStart
        const absEnd = region.readPositions[idx * 2 + 1]! + region.regionStart
        const y = region.readYs[idx]!
        const covOff = state.pileupTopOffset
        const clip = toClipRect(
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
        const quads = new Float32Array([
          clip.sx1,
          clip.syTop,
          clip.sx2,
          clip.syTop - ty,
          0,
          0.722,
          1,
          1,
          clip.sx1,
          clip.syBot + ty,
          clip.sx2,
          clip.syBot,
          0,
          0.722,
          1,
          1,
          clip.sx1,
          clip.syTop,
          clip.sx1 + tx,
          clip.syBot,
          0,
          0.722,
          1,
          1,
          clip.sx2 - tx,
          clip.syTop,
          clip.sx2,
          clip.syBot,
          0,
          0.722,
          1,
          1,
        ])
        this.drawOverlayQuads(
          quads,
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

    // Chain overlays
    const quads: number[] = []
    const covOff = state.pileupTopOffset

    if (state.highlightedChainIds.length > 0) {
      const bounds = getChainBounds(
        state.highlightedChainIds,
        region.readIdToIndex,
        region.readPositions,
        region.readYs,
      )
      if (bounds) {
        const clip = toClipRect(
          bounds.minStart + region.regionStart,
          bounds.maxEnd + region.regionStart,
          bounds.y,
          state,
          bpHi,
          bpLo,
          bpLen,
          covOff,
          state.canvasHeight,
          block.reversed,
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
        const clip = toClipRect(
          bounds.minStart + region.regionStart,
          bounds.maxEnd + region.regionStart,
          bounds.y,
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
        quads.push(
          clip.sx1,
          clip.syTop,
          clip.sx2,
          clip.syTop - ty,
          0,
          0.722,
          1,
          1,
          clip.sx1,
          clip.syBot + ty,
          clip.sx2,
          clip.syBot,
          0,
          0.722,
          1,
          1,
          clip.sx1,
          clip.syTop,
          clip.sx1 + tx,
          clip.syBot,
          0,
          0.722,
          1,
          1,
          clip.sx2 - tx,
          clip.syTop,
          clip.sx2,
          clip.syBot,
          0,
          0.722,
          1,
          1,
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
    this.hal.setViewport(
      Math.round(scissorX * dpr),
      0,
      Math.round(scissorW * dpr),
      bufH,
    )
    this.hal.setScissor(
      Math.round(scissorX * dpr),
      pileupTop,
      Math.round(scissorW * dpr),
      pileupH,
    )
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

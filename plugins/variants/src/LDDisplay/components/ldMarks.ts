import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { drawLDBlocks } from './drawLDBlocks.ts'
import { generateLDColorRamp } from './ldColorRamp.ts'
import * as ldGenomicShader from './shaders/ldGenomic.generated.ts'
import * as ldUniformShader from './shaders/ldUniform.generated.ts'

import type {
  LDDrawState,
  LDRenderState,
  LDUploadData,
} from './ldRenderingBackendTypes.ts'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { MarkShape } from '@jbrowse/render-core/marks'

// The generated packer, not a loop of our own: `ldGenomic`'s instance struct is
// exactly `{position: float2, cellSize: float2, ldValue: float}`, and
// `packInstances` reads a vecN field as N consecutive values per instance —
// which is the shape `positions` and `cellSizes` already have. The hand-written
// interleave this replaces was a field-for-field transcription of it.
//
// Unlike the append-at-a-time `InstanceWriter`, this costs nothing: it is one
// call containing the whole loop, not a call per instance.
export function interleaveLDInstances(data: {
  positions: Float32Array
  cellSizes: Float32Array
  ldValues: Float32Array
  numCells: number
}) {
  return ldGenomicShader.packInstances(
    {
      position: data.positions,
      cellSize: data.cellSizes,
      ldValue: data.ldValues,
    },
    data.numCells,
  )
}

interface LDCellParams extends LDDrawState {
  uniformW: number
  band: number
  // Which of the two layouts the payload carries, and so which mark draws it.
  genomic: boolean
  colorRamp: Uint8Array
}

const EMPTY = new Float32Array(0)

// Which layout the payload carries: the per-cell positions are present only in
// genomic mode, and the worker sends neither or both.
function isGenomic(
  data: LDUploadData,
): data is LDUploadData & { positions: Float32Array; cellSizes: Float32Array } {
  return data.positions !== undefined && data.cellSizes !== undefined
}

/**
 * One layout of the LD triangle: its pass, the shared uniform write, and the
 * one painter both layouts take (it walks `boundaries`, which describe either).
 *
 * `draws` is the gate both backends take, and it is the same decision as the
 * pack: the payload carries one layout's buffers, and the other mark's pack
 * returns empty — which IS the release, so a matrix holds only the layout it
 * was computed in.
 */
function ldShape(
  pass: InstancePass<LDUploadData>,
  draws: (genomic: boolean) => boolean,
): MarkShape<LDUploadData, LDCellParams> {
  return {
    id: pass.id,
    pass,
    paintsBlock: (_block, _frame, p) => draws(p.genomic),
    writeUniforms(scratch, _clip, _block, frame, p) {
      // Either variant's offsets are authoritative — both draw the one
      // `ldUniforms.slang` block — so the packer is `ldGenomic`'s.
      ldGenomicShader.writeUniforms(scratch, {
        canvasSize: [frame.canvasWidth, frame.canvasHeight],
        yScalar: p.yScalar,
        viewScale: p.viewScale,
        viewOffsetX: p.viewOffsetX,
        uniformW: p.uniformW,
        // Uniform mode's vertex shader turns instance_index back into (i, j)
        // through this; genomic mode carries per-cell positions and ignores it.
        band: p.band,
      })
    },
    paintBlock(ctx, data, _block, _frame, p) {
      drawLDBlocks(ctx, data, p.colorRamp, p)
    },
  }
}

const uniformShape = ldShape(
  {
    ...slangPass({ id: 'main', mod: ldUniformShader }),
    // The values are the instance buffer: one float per cell, laid out at the
    // pitch the shader decodes from `band` and `uniformW`. No floor beyond the
    // empty case — numCells is the triangular count n*(n-1)/2, so a single cell
    // is a real two-SNP matrix that the painter draws.
    pack: data => (isGenomic(data) ? EMPTY : data.ldValues),
  },
  genomic => !genomic,
)

const genomicShape = ldShape(
  {
    ...slangPass({ id: 'genomic', mod: ldGenomicShader }),
    pack: data => (isGenomic(data) ? interleaveLDInstances(data) : EMPTY),
  },
  genomic => genomic,
)

function ldParams(state: LDRenderState, data: LDUploadData): LDCellParams {
  return {
    yScalar: state.yScalar,
    viewScale: state.viewScale,
    viewOffsetX: state.viewOffsetX,
    uniformW: data.uniformW,
    band: data.band,
    genomic: isGenomic(data),
    // Off the payload's own metric rather than the requested one: a
    // pre-computed file with no D' column downgrades the request, and the two
    // tables are module-level, so the backend re-uploads the 256×1 texture only
    // when the loaded metric actually moves.
    colorRamp: generateLDColorRamp(data.metric),
  }
}

const channels = (data: LDUploadData) => data

const texture = (_state: LDRenderState, data: LDUploadData) =>
  generateLDColorRamp(data.metric)

/**
 * The LD triangle as a mark list: one mark per layout over the two hand-written
 * shaders, and one uniform block behind both, since each entry shader imports
 * `ldUniforms.slang`'s.
 */
export const LD_MARKS = [
  defineMark({
    shape: uniformShape,
    channels,
    params: ldParams,
    texture,
  }),
  defineMark({
    shape: genomicShape,
    channels,
    params: ldParams,
    texture,
  }),
]

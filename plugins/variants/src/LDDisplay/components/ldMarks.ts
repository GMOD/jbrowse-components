import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { drawLDBlocks } from './drawLDBlocks.ts'
import * as ldGenomicShader from './shaders/ldGenomic.generated.ts'
import * as ldUniformShader from './shaders/ldUniform.generated.ts'

import type { LDRenderState, LDUploadData } from './ldRenderingBackendTypes.ts'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { MarkShape } from '@jbrowse/render-core/marks'

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

interface LDCellParams extends LDRenderState {
  uniformW: number
  band: number
  genomic: boolean
}

const EMPTY = new Float32Array(0)

// The worker sends per-cell positions only at genomic positions.
function isGenomic(
  data: LDUploadData,
): data is LDUploadData & { positions: Float32Array; cellSizes: Float32Array } {
  return data.positions !== undefined && data.cellSizes !== undefined
}

/**
 * One layout of the triangle. The payload carries one layout's buffers, and
 * the other mark packs empty and paints nothing.
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
      // both shaders draw the one `ldUniforms.slang` block
      ldGenomicShader.writeUniforms(scratch, {
        canvasSize: [frame.canvasWidth, frame.canvasHeight],
        yScalar: p.yScalar,
        viewScale: p.viewScale,
        viewOffsetX: p.viewOffsetX,
        uniformW: p.uniformW,
        band: p.band,
        domainMin: p.domainMin,
        domainMax: p.domainMax,
      })
    },
    paintBlock(ctx, data, _block, frame, p) {
      drawLDBlocks(ctx, data, p, frame.canvasWidth)
    },
  }
}

const uniformShape = ldShape(
  {
    ...slangPass({ id: 'main', mod: ldUniformShader }),
    // the values are the instance buffer; the shader decodes (i, j) from the
    // instance index through `band` and `uniformW`
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
    ...state,
    uniformW: data.uniformW,
    band: data.band,
    genomic: isGenomic(data),
  }
}

const channels = (data: LDUploadData) => data

const textures = (state: LDRenderState) => ({ colorRamp: state.colorRamp })

export const LD_MARKS = [
  defineMark({ shape: uniformShape, channels, params: ldParams, textures }),
  defineMark({ shape: genomicShape, channels, params: ldParams, textures }),
]

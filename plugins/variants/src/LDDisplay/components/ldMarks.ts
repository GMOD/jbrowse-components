import { ldValueComputed } from '@jbrowse/ld-core'
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { bandRowFirstColumn } from '../../RenderLDDataRPC/ldBand.ts'
import { drawLDBlocks } from './drawLDBlocks.ts'
import * as ldGenomicShader from './shaders/ldGenomic.generated.ts'
import {
  INSTANCE_OFFSET_F32 as OFF,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/ldGenomic.iface.generated.ts'
import * as ldUniformShader from './shaders/ldUniform.generated.ts'

import type { LDRenderState, LDUploadData } from './ldRenderingBackendTypes.ts'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { MarkShape } from '@jbrowse/render-core/marks'

/**
 * One genomic-layout instance per cell the file reported, in `ldValues`' band
 * order. A cell's rect is `[b[j], b[j+1]] x [b[i], b[i+1]]` over `boundaries`,
 * as `drawLDBlocks` paints it; an uncomputed cell gets no instance, since its
 * corners are explicit and dropping it shifts no other cell.
 */
export function packGenomicCells({
  boundaries,
  band,
  ldValues,
  numCells,
}: Pick<LDUploadData, 'boundaries' | 'band' | 'ldValues' | 'numCells'>) {
  let computed = 0
  for (let k = 0; k < numCells; k++) {
    if (ldValueComputed(ldValues[k]!)) {
      computed++
    }
  }
  const buf = new ArrayBuffer(computed * INSTANCE_STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  const { position, cellSize, ldValue } = OFF
  const n = boundaries.length - 1
  let k = 0
  let o = 0
  for (let i = 1; i < n; i++) {
    const y = boundaries[i]!
    const ch = boundaries[i + 1]! - y
    for (let j = bandRowFirstColumn(i, band); j < i; j++) {
      const v = ldValues[k++]!
      if (ldValueComputed(v)) {
        const x = boundaries[j]!
        f32[o + position] = x
        f32[o + position + 1] = y
        f32[o + cellSize] = boundaries[j + 1]! - x
        f32[o + cellSize + 1] = ch
        f32[o + ldValue] = v
        o += INSTANCE_STRIDE_WORDS
      }
    }
  }
  return buf
}

interface LDCellParams extends LDRenderState {
  uniformW: number
  band: number
  genomic: boolean
}

const EMPTY = new Float32Array(0)

function isGenomic(data: LDUploadData) {
  return data.appliedLayout === 'genomic'
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
        domainMin: p.color.domain[0],
        domainMax: p.color.domain[1],
        rampMidNorm: p.color.midNorm,
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
    pack: data => (isGenomic(data) ? packGenomicCells(data) : EMPTY),
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

const textures = (state: LDRenderState) => ({ colorRamp: state.color.ramp })

export const LD_MARKS = [
  defineMark({ shape: uniformShape, channels, params: ldParams, textures }),
  defineMark({ shape: genomicShape, channels, params: ldParams, textures }),
]

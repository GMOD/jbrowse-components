// Features with one end on screen and the other far off it, at the deepest
// zoom. A quad corner built as `lerp(far, near, 1)` comes back carrying the far
// corner's float32 rounding on a backend that computes `a + t * (b - a)`, and a
// corner built as the far end plus a length carries it on every backend. The
// rounding a near corner picks up is its own clip x modulo the far one's ulp,
// which is 0 at a clip x like 0 or 0.5, so the near ends sit at whole px of a
// 225 px canvas, four per distance and side. Mesa folds quadLocal's 0/1 weight
// into a select, so llvmpipe shows only the far-end-plus-length rows.
import { valueToYPxUnclamped } from '../../../packages/render-core/src/shaders/valueScale.js.generated.ts'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_XYPLOT,
} from '../../../packages/wiggle-core/src/wiggleRenderModes.generated.ts'
import * as gap from '../../../plugins/alignments/src/shaders/slang/gap.generated.ts'
import * as read from '../../../plugins/alignments/src/shaders/slang/read.generated.ts'
import * as wiggle from '../../../plugins/wiggle/src/shared/shaders/wiggle.generated.ts'
import * as wiggleLine from '../../../plugins/wiggle/src/shared/shaders/wiggleLine.generated.ts'
import { abgr, box, defineFixture, paintOver, rgba } from '../fixture.ts'
import { pileupUniforms } from './alignments.ts'
import { uniforms as wiggleUniforms } from './wiggle.ts'

import type { Rgba, Shape } from '../fixture.ts'

export const FAR_PX = [1e5, 1e6, 1e7, 1e8] as const

const W = 225
const ROW_PX = 8
const PX_PER_BP = 50
const BP_LEN = W / PX_PER_BP
const VIEW_START = 50_000_000
const VIEW_HI = Math.floor(VIEW_START / 4096) * 4096
const VIEW_LO = VIEW_START - VIEW_HI
const NEAR_BP = [1, 2, 3, 4].map(k => VIEW_START + k)

const px = (bp: number) => (bp - VIEW_START) * PX_PER_BP
export const rows = [true, false]
  .flatMap(offLeft =>
    FAR_PX.flatMap(farPx =>
      NEAR_BP.map(near => {
        const farBp = farPx / PX_PER_BP
        return {
          offLeft,
          farPx,
          start: offLeft ? near - farBp : near,
          end: offLeft ? near : near + farBp,
        }
      }),
    ),
  )
  .map((r, row) => ({ ...r, row, x1: px(r.start), x2: px(r.end) }))
const ROWS = rows.length
const H = ROWS * ROW_PX
const DPRS = [1, 2]
// No `bounds`: paintOver buckets a bounded shape per 4 px, and these run 1e8 px.
const span = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: Rgba,
): Shape => ({ inside: box(left, top, right, bottom), color })
const about = (what: string) =>
  `${what} at ${PX_PER_BP} px/bp, one end on screen, the other ${FAR_PX.map(d => d.toExponential(0)).join('/')} px off the left (rows 0-15) or right (16-31)`

const BLUE = [31, 119, 180] as const
const RED = [214, 39, 40] as const
const DOMAIN = [0, 100] as const
const wiggleY = (score: number, row: number) =>
  row * ROW_PX + valueToYPxUnclamped(score, DOMAIN[0], DOMAIN[1], ROW_PX, 0, 1)

function wiggleFarUniforms(renderingType: number, dpr: number, lineWidth = 1) {
  return {
    ...wiggleUniforms(renderingType, dpr, { numRows: ROWS, lineWidth }),
    bpRangeX: [VIEW_HI, VIEW_LO, BP_LEN] as [number, number, number],
    canvasHeight: H,
    viewportWidth: W,
  }
}

const BAR_SCORE = 75
const barFixture = defineFixture({
  name: 'far-corner-wiggle-bar',
  slang: 'plugins/wiggle/src/shared/shaders/wiggle.slang',
  about: about('xyplot bars'),
  mod: wiggle,
  width: W,
  height: H,
  dprs: DPRS,
  count: ROWS,
  instances: {
    startEnd: rows.flatMap(r => [r.start, r.end]),
    score: rows.map(() => BAR_SCORE),
    color: rows.map(() => abgr(BLUE)),
    rowIndex: rows.map(r => r.row),
  },
  uniforms: (dpr: number) => wiggleFarUniforms(RENDERING_TYPE_XYPLOT, dpr),
  reference: paintOver(
    rows.map(r =>
      span(
        r.x1,
        wiggleY(BAR_SCORE, r.row),
        r.x2,
        (r.row + 1) * ROW_PX,
        rgba(BLUE),
      ),
    ),
  ),
})

const STEP_SCORE = 50
const STEP_LINE_PX = 2
const stepFixture = defineFixture({
  name: 'far-corner-wiggle-step',
  slang: 'plugins/wiggle/src/shared/shaders/wiggleLine.slang',
  about: about(
    `${STEP_LINE_PX} px step-line runs abutting runs at the same score`,
  ),
  mod: wiggleLine,
  width: W,
  height: H,
  dprs: DPRS,
  count: ROWS,
  instances: {
    startEnd: rows.flatMap(r => [r.start, r.end]),
    score: rows.map(() => STEP_SCORE),
    prevScore: rows.map(() => STEP_SCORE),
    nextScore: rows.map(() => STEP_SCORE),
    color: rows.map(() => abgr(RED)),
    rowIndex: rows.map(r => r.row),
    negColor: rows.map(() => abgr(RED)),
  },
  uniforms: (dpr: number) =>
    wiggleFarUniforms(RENDERING_TYPE_LINE, dpr, STEP_LINE_PX),
  reference: paintOver(
    rows.map(r => {
      const y = wiggleY(STEP_SCORE, r.row)
      const hw = STEP_LINE_PX / 2
      return span(r.x1 - hw, y - hw, r.x2 + hw, y + hw, rgba(RED))
    }),
  ),
})

const FEAT_H = 7
const FEAT_SPACING = ROW_PX - FEAT_H
const FWD = [236, 139, 139] as const
const REV = [143, 143, 216] as const
const DELETION = [128, 128, 128] as const

function pileupFarUniforms(dpr: number) {
  return {
    ...pileupUniforms(W, H, 1 / PX_PER_BP, FEAT_H, FEAT_SPACING, dpr),
    bpHi: VIEW_HI,
    bpLo: VIEW_LO,
    bpLen: BP_LEN,
    pxPerBp: PX_PER_BP,
    colorDeletion: abgr(DELETION),
  }
}

// A read off the left is reverse-strand and one off the right forward, so its
// arrowhead sits on the far end and the near end is the body's own.
function readColorAt(x: number, y: number): Rgba {
  const r = rows[Math.floor(y / ROW_PX)]
  const top = r ? r.row * ROW_PX : 0
  if (!r || x < r.x1 || x >= r.x2 || y >= top + FEAT_H) {
    return [0, 0, 0, 0]
  }
  const rgb = r.offLeft ? REV : FWD
  const edge = Math.min(
    r.offLeft ? r.x2 - x : x - r.x1,
    y - top,
    top + FEAT_H - y,
  )
  return edge < read.READ_OUTLINE_PX
    ? rgba([
        rgb[0] * read.READ_OUTLINE_SHADE,
        rgb[1] * read.READ_OUTLINE_SHADE,
        rgb[2] * read.READ_OUTLINE_SHADE,
      ])
    : rgba(rgb)
}

const readFixture = defineFixture({
  name: 'far-corner-read',
  slang: 'plugins/alignments/src/shaders/slang/read.slang',
  about: about(`pileup reads ${FEAT_H} px tall, arrowhead on the far end`),
  mod: read,
  width: W,
  height: H,
  dprs: DPRS,
  count: ROWS,
  instances: {
    startOff: rows.map(r => r.start),
    endOff: rows.map(r => r.end),
    insertSize: rows.map(() => 0),
    fillColor: rows.map(() => 0),
    packedFields: rows.map(
      r =>
        (r.row << read.READ_PACK_ROW_SHIFT) |
        ((r.offLeft ? read.RC_REV_STRAND : read.RC_FWD_STRAND) <<
          read.READ_PACK_CATEGORY_SHIFT) |
        ((r.offLeft ? 0 : 2) << read.READ_PACK_STRAND_SHIFT) |
        (3 << read.READ_PACK_EDGE_SHIFT),
    ),
  },
  uniforms: pileupFarUniforms,
  reference: readColorAt,
})

const gapFixture = defineFixture({
  name: 'far-corner-deletion',
  slang: 'plugins/alignments/src/shaders/slang/gap.slang',
  about: about(`deletions ${FEAT_H} px tall`),
  mod: gap,
  width: W,
  height: H,
  dprs: DPRS,
  count: ROWS,
  instances: {
    startOff: rows.map(r => r.start),
    endOff: rows.map(r => r.end),
    rowAndType: rows.map(r => r.row | (gap.GAP_DELETION << gap.GAP_ROW_BITS)),
    frequency: rows.map(() => 1),
  },
  uniforms: pileupFarUniforms,
  reference: paintOver(
    rows.map(r =>
      span(r.x1, r.row * ROW_PX, r.x2, r.row * ROW_PX + FEAT_H, rgba(DELETION)),
    ),
  ),
})

export default [barFixture, stepFixture, readFixture, gapFixture]

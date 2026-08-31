import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { KIND_BASE_TILE } from './shaders/syntenyTypes.generated.ts'
import { pickFeatureAtPoint } from './syntenyPickEngine.ts'
import {
  buildFeaturePath,
  computeTransform,
  makeCornerScratch,
  projectCorners,
  ribbonMaxPerpWidth,
} from './syntenyRibbonPath.ts'
import { createGeometricPickCtx } from './testUtils.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickIndex } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

// Transparent-indels mode ('matches') drops each feature's full-span KIND_BASE
// quad and paints one KIND_BASE_TILE per CIGAR match segment instead, so a
// feature has no single instance covering it. What the reader SEES is still one
// ribbon — the tiles carry a 1px minimum footprint and `thinWidthFade` fades
// them so the overlap adds back up to the feature — and the hover has to agree
// with that, which is what `buildPickIndex`'s synthetic feature bodies are for.
//
// Every assertion here is stated against colored-indel mode over the same
// alignment: cigarMode says how indels are SHADED, so it must not decide what is
// hoverable, and colored mode is where that was already true.

const BP_PER_PX = 100
const HEIGHT = 100
const VIEW_WIDTH = 1400
const OPAQUE_GRAY = 0xff808080

const packed = (len: number, op: number) => (len << 4) | op

interface Block {
  cigar: number[]
  queryStart: number
  targetStart: number
}

// The spans the ops consume, so a block's declared corners agree with the walk
// its CIGAR describes. A p12/p22 wider than the walk reaches would leave the
// colored mode's quad covering ribbon the alignment never claims, and every
// comparison below reads that difference as a hover the tiled mode lost.
function cigarSpans(cigar: number[]) {
  let query = 0
  let target = 0
  for (const op of cigar) {
    const len = op >>> 4
    if ((op & 0xf) === CIGAR_M) {
      query += len
      target += len
    } else {
      query += len
    }
  }
  return { query, target }
}

function geometry(blocks: Block[], matchesOnly: boolean): SyntenyInstanceData {
  const spans = blocks.map(b => cigarSpans(b.cigar))
  const g = buildSyntenyGeometry({
    p11_cumBp: Float64Array.from(blocks, b => b.queryStart),
    p12_cumBp: Float64Array.from(
      blocks,
      (b, i) => b.queryStart + spans[i]!.query,
    ),
    p21_cumBp: Float64Array.from(blocks, b => b.targetStart),
    p22_cumBp: Float64Array.from(
      blocks,
      (b, i) => b.targetStart + spans[i]!.target,
    ),
    queryGridAnchors: Float64Array.from(blocks, b => b.queryStart),
    strands: Int8Array.from(blocks, () => 1),
    parsedCigars: blocks.map(b => b.cigar),
    starts: Uint32Array.from(blocks, b => b.queryStart),
    ends: Uint32Array.from(blocks, (b, i) => b.queryStart + spans[i]!.query),
    drawCIGAR: true,
    drawCIGARMatchesOnly: matchesOnly,
    bpPerPx0: BP_PER_PX,
    bpPerPx1: BP_PER_PX,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: VIEW_WIDTH,
  })
  return { ...g, colors: new Uint32Array(g.instanceCount).fill(OPAQUE_GRAY) }
}

const params: SyntenyTrackRenderParams = {
  yTop: 0,
  height: HEIGHT,
  alpha: 1,
  fadeThinAlignments: true,
  minAlignmentLength: 0,
  hoveredFeatureId: 0,
  clickedFeatureId: 0,
  offsetPx0: 0,
  offsetPx1: 0,
  bpPerPx0: BP_PER_PX,
  bpPerPx1: BP_PER_PX,
  drawCurves: false,
}

// The feature a hover at `x` answers, mid-band, or undefined for a miss.
function pickedFeatureAt(
  data: SyntenyInstanceData,
  x: number,
  pickIndices = new Map<number, PickIndex>(),
) {
  const state: SyntenyRenderState = {
    overdrawPx: 1000,
    groundColor: '#fff',
    perTrack: new Map([[0, params]]),
  }
  const hit = pickFeatureAtPoint({
    ctx: createGeometricPickCtx(),
    state,
    regions: new Map([[0, data]]),
    pickIndices,
    canvasLogicalWidth: VIEW_WIDTH,
    x,
    y: HEIGHT / 2,
  })
  return hit ? data.instanceFeatureIdx[hit.instanceIndex] : undefined
}

// Where the ribbon runs at the height the sweeps hover at: a sheared block's
// mid-band x is the average of its two edges', so sweeping its query span alone
// would sample mostly empty canvas.
function midBandSpanPx(block: Block) {
  const { query, target } = cigarSpans(block.cigar)
  const left = (block.queryStart + block.targetStart) / 2 / BP_PER_PX
  const right =
    (block.queryStart + query + block.targetStart + target) / 2 / BP_PER_PX
  return { left, right }
}

// One index for the whole sweep, as a real hover has: rebuilding per position
// would make this hundreds of index builds and say nothing extra.
function sweep(data: SyntenyInstanceData, from: number, to: number) {
  const pickIndices = new Map<number, PickIndex>()
  const out: (number | undefined)[] = []
  for (let x = from; x <= to; x++) {
    out.push(pickedFeatureAt(data, x, pickIndices))
  }
  return out
}

// The widest any one tile ever gets perpendicular to itself — the measure
// `pickFeatureAtPoint` applies per candidate. Used to keep the sub-pixel test
// below from passing vacuously on tiles that were a pixel wide all along.
function widestTilePx(data: SyntenyInstanceData) {
  const t = computeTransform(params, data)
  const scratch = makeCornerScratch()
  let widest = 0
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.kinds[i] === KIND_BASE_TILE) {
      const c = projectCorners(data, i, t, scratch)
      widest = Math.max(widest, ribbonMaxPerpWidth(c, HEIGHT, false))
    }
  }
  return widest
}

// Is any match tile painted under the hover point? The deletion a hover lands in
// has to be a real hole at the height the sweeps run at, not just on the query
// axis: a deletion SHEARS the ribbon, so the tile after it starts further left
// at mid-band than its top edge suggests.
function tileCoversAt(data: SyntenyInstanceData, x: number) {
  const t = computeTransform(params, data)
  const scratch = makeCornerScratch()
  const ctx = createGeometricPickCtx()
  for (let i = 0; i < data.instanceCount; i++) {
    if (data.kinds[i] === KIND_BASE_TILE) {
      buildFeaturePath(
        ctx,
        projectCorners(data, i, t, scratch),
        0,
        HEIGHT,
        false,
      )
      if (ctx.isPointInPath(x, HEIGHT / 2)) {
        return true
      }
    }
  }
  return false
}

// M50px D20px M50px: one alignment with a deletion wide enough to render, so
// transparent mode leaves a 20px see-through hole where colored mode paints a
// deletion wedge over the full-span quad.
const GAPPED: Block = {
  cigar: [packed(5000, CIGAR_M), packed(2000, CIGAR_D), packed(5000, CIGAR_M)],
  queryStart: 0,
  targetStart: 0,
}

// 2px match tiles either side of 2px deletions, sheared 600px down the band, so
// every tile is far below a pixel perpendicular while the feature they build is
// 400px of solid ribbon. Match at both ends, as an alignment has: a body spans
// the tiles that were EMITTED, so a CIGAR ending in a rendered indel ends in
// see-through ribbon that nothing paints and nothing picks.
const SHEARED_DENSE: Block = {
  cigar: Array.from({ length: 199 }, (_, i) =>
    packed(200, i % 2 === 0 ? CIGAR_M : CIGAR_D),
  ),
  queryStart: 0,
  targetStart: 60_000,
}

test('a hover over a see-through indel answers the feature it belongs to', () => {
  const tiled = geometry([GAPPED], true)
  // Not vacuous: nothing is painted here, so answering is the body's doing.
  expect(tileCoversAt(tiled, 55)).toBe(false)
  expect(pickedFeatureAt(tiled, 55)).toBe(0)
  expect(pickedFeatureAt(geometry([GAPPED], false), 55)).toBe(0)
})

test('a feature whose tiles are each sub-pixel is still hoverable', () => {
  const tiled = geometry([SHEARED_DENSE], true)
  // Not vacuous: every tile is on the non-pickable side of the perpW gate, so
  // answering this hover is the body's doing and nothing else's.
  expect(widestTilePx(tiled)).toBeLessThan(1)
  const { left, right } = midBandSpanPx(SHEARED_DENSE)
  const mid = Math.round((left + right) / 2)
  expect(pickedFeatureAt(tiled, mid)).toBe(0)
  expect(pickedFeatureAt(geometry([SHEARED_DENSE], false), mid)).toBe(0)
})

test('transparent indels answer a hover wherever colored indels do', () => {
  for (const block of [GAPPED, SHEARED_DENSE]) {
    // Past both ends, so the sweep covers the empty canvas either side and a
    // mode answering too widely fails as loudly as one answering too narrowly.
    const { left, right } = midBandSpanPx(block)
    const from = Math.max(1, Math.round(left) - 20)
    const to = Math.round(right) + 20
    expect(sweep(geometry([block], true), from, to)).toEqual(
      sweep(geometry([block], false), from, to),
    )
  }
})

test('a body loses to a feature drawn over it', () => {
  // The second block lies inside the first's deletion, and is emitted after it,
  // so it is on top — the body must not answer for the ribbon underneath.
  const blocks = [
    GAPPED,
    { cigar: [packed(4000, CIGAR_M)], queryStart: 4000, targetStart: 4000 },
  ]
  expect(pickedFeatureAt(geometry(blocks, true), 60)).toBe(1)
  expect(pickedFeatureAt(geometry(blocks, false), 60)).toBe(1)
})

test('a body thinner than a pixel is no more pickable than a tile', () => {
  // The whole-genome exclusion is what keeps the index small (SYNTENY_PICKING.md
  // — `kept` is 0 at that zoom), and a body has to obey it too: this feature is
  // 4px of query span smeared over 600px of travel, which every backend draws as
  // a hairline rather than a band.
  const hairline: Block = {
    cigar: [packed(200, CIGAR_M), packed(200, CIGAR_D), packed(200, CIGAR_M)],
    queryStart: 0,
    targetStart: 60_000,
  }
  expect(pickedFeatureAt(geometry([hairline], true), 2)).toBeUndefined()
  expect(pickedFeatureAt(geometry([hairline], false), 2)).toBeUndefined()
})

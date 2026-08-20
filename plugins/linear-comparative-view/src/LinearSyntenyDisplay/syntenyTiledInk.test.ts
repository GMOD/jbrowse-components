import { createCanvas } from 'canvas'

import { buildSyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { KIND_MARKER } from '../LinearSyntenyRPC/syntenyColors.ts'
import { drawSyntenyTrack } from './Canvas2DSyntenyRenderer.ts'

// How much ink transparent-indel mode lays down against the colored-indel mode
// it is otherwise the complement of, on a real rasterizer.
//
// Colored mode paints a feature as ONE full-span quad; transparent mode paints
// one per match segment, so the indels between them show through. Both cover the
// same ribbon, so both should read as about the same amount of red — the
// transparent one somewhat less, since the indels it leaves out are real gaps.
//
// What broke that is the 1px minimum footprint every renderer gives a
// sub-pixel-thin ribbon (perpCoverage's `expand`, and this backend's centerline
// stroke). Tiles are pitched their own perpendicular width apart, so once a
// ribbon is sheared enough to take them under a pixel, each tile's 1px band
// overlaps its neighbours' and N of them composite to 1-(1-a)^N. `thinWidthFade`
// scales each tile's alpha back down by its true width, which is what makes them
// add up again; the bug was that a match tile carried KIND_BASE and so inherited
// a fade a display toggle can switch off. Measured here at 2.75x before, on a
// ribbon sheared 9x its own height.
//
// Rendered rather than modelled: the quantity that went wrong is composited
// alpha over a pixel, which is the rasterizer's answer and not one the draw
// calls state.
const VIEW_W = 1400
const HEIGHT = 100
const BP_PER_PX = 2500
const DISPLAY_ALPHA = 0.2
const Q_START = 500_000

interface Ribbon {
  // How far the ribbon's bottom end sits from its top one, i.e. how rearranged
  // the block is. Between this and `matchBp` it is what takes a tile sub-pixel:
  // perpendicular width is horizontal width over sqrt(1 + (shearPx/HEIGHT)^2).
  shearPx?: number
  reps?: number
  matchBp?: number
  deletionBp?: number
  fadeThinAlignments?: boolean
}

// reps x (matchBp M, deletionBp D). Both operands clear a pixel on the axis they
// advance, so the visitor emits one segment each rather than merging them into
// their neighbours.
function cigar(reps: number, matchBp: number, deletionBp: number) {
  const CIGAR_M = 0
  const CIGAR_D = 2
  const ops: number[] = []
  for (let i = 0; i < reps; i++) {
    ops.push((matchBp << 4) | CIGAR_M, (deletionBp << 4) | CIGAR_D)
  }
  return ops
}

function drawnInk(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
) {
  // Red over white, so the green channel's shortfall from 255 IS the composited
  // alpha; summed over the frame it is how much red the pass laid down.
  const px = ctx.getImageData(0, 0, VIEW_W, HEIGHT).data
  let ink = 0
  for (let i = 1; i < px.length; i += 4) {
    ink += (255 - px[i]!) / 255
  }
  return ink
}

function render(
  g: ReturnType<typeof buildSyntenyGeometry>,
  fadeThinAlignments: boolean,
) {
  // Location markers painted to nothing: they are the ruler continued through
  // the ribbon, drawn at their own fixed alpha, and both modes emit the same
  // ones. Counting them would just add a constant to both sides.
  const colors = Uint32Array.from(g.kinds, k =>
    k === KIND_MARKER ? 0 : 0xff0000ff,
  )
  const canvas = createCanvas(VIEW_W, HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, VIEW_W, HEIGHT)
  drawSyntenyTrack(
    ctx,
    { ...g, colors },
    {
      yTop: 0,
      height: HEIGHT,
      alpha: DISPLAY_ALPHA,
      minAlignmentLength: 0,
      hoveredFeatureId: 0,
      clickedFeatureId: 0,
      offsetPx0: 0,
      offsetPx1: 0,
      bpPerPx0: BP_PER_PX,
      bpPerPx1: BP_PER_PX,
      drawCurves: false,
      fadeThinAlignments,
    },
    VIEW_W,
    300,
  )
  return drawnInk(ctx)
}

function inkOf(matchesOnly: boolean, ribbon: Ribbon = {}) {
  const {
    shearPx = 0,
    reps = 40,
    matchBp = 5000,
    deletionBp = 2500,
    fadeThinAlignments = false,
  } = ribbon
  const qEnd = Q_START + reps * (matchBp + deletionBp)
  const tStart = Q_START + shearPx * BP_PER_PX
  return render(
    buildSyntenyGeometry({
      p11_cumBp: Float64Array.from([Q_START]),
      p12_cumBp: Float64Array.from([qEnd]),
      p21_cumBp: Float64Array.from([tStart]),
      p22_cumBp: Float64Array.from([tStart + reps * matchBp]),
      queryGridAnchors: Float64Array.from([0]),
      strands: Int8Array.from([1]),
      parsedCigars: [cigar(reps, matchBp, deletionBp)],
      starts: Uint32Array.from([Q_START]),
      ends: Uint32Array.from([qEnd]),
      drawCIGAR: true,
      drawCIGARMatchesOnly: matchesOnly,
      bpPerPx0: BP_PER_PX,
      bpPerPx1: BP_PER_PX,
      viewOff0: 0,
      viewOff1: 0,
      viewWidth: VIEW_W,
    }),
    fadeThinAlignments,
  )
}

test.each([0, 300, 600, 900])(
  'transparent indels lay down no more ink than colored ones, sheared %ipx',
  shearPx => {
    const colored = inkOf(false, { shearPx })
    // The tiles reach 0.22 perpendicular px at the widest shear here, which is
    // the regime the overlap lived in.
    expect(inkOf(true, { shearPx })).toBeLessThan(colored * 1.1)
    // And it is not the deletions doing the work: transparent mode still paints
    // most of the ribbon.
    expect(inkOf(true, { shearPx })).toBeGreaterThan(colored * 0.5)
  },
)

test('how finely the CIGAR is cut does not change how much ink it takes', () => {
  // One ribbon and one match fraction, cut twice: 40 tiles of 0.115
  // perpendicular px against 20 of 0.23. The picture is the same either way, so
  // the ink is too — which is what fails if a tile's fade keeps the whole-ribbon
  // FLOOR. That floor is there to hold a lone hairline at a locatable 0.15
  // rather than let it fade toward invisible; applied to ~9 tiles per pixel it
  // just re-inflates the product the fade exists to keep flat, measured at 1.33x
  // the coarse cut.
  const fine = inkOf(true, {
    shearPx: 900,
    reps: 40,
    matchBp: 2600,
    deletionBp: 3000,
  })
  const coarse = inkOf(true, {
    shearPx: 900,
    reps: 20,
    matchBp: 5200,
    deletionBp: 6000,
  })
  expect(fine).toBeGreaterThan(coarse * 0.9)
  expect(fine).toBeLessThan(coarse * 1.1)
})

test('a tiled ribbon paints the same whether or not thin ribbons are faded', () => {
  // The toggle asks for each ALIGNMENT at full alpha. A tile is not an
  // alignment, so answering it per tile is what multiplied the ink — and the
  // fade a tile takes is arithmetic that both settings need.
  for (const shearPx of [0, 900]) {
    expect(inkOf(true, { shearPx, fadeThinAlignments: false })).toBeCloseTo(
      inkOf(true, { shearPx, fadeThinAlignments: true }),
      5,
    )
  }
})

test('the toggle still reaches an untiled thin ribbon', () => {
  // The same ribbon with no CIGAR to tile, narrow and sheared enough that the
  // whole thing is sub-pixel: this is the ribbon the floor and the toggle are
  // for, and the tile rule must not have flattened them.
  const untiled = (fadeThinAlignments: boolean) =>
    render(
      buildSyntenyGeometry({
        p11_cumBp: Float64Array.from([Q_START]),
        p12_cumBp: Float64Array.from([Q_START + 1000]),
        p21_cumBp: Float64Array.from([2_000_000]),
        p22_cumBp: Float64Array.from([2_001_000]),
        queryGridAnchors: Float64Array.from([0]),
        strands: Int8Array.from([1]),
        parsedCigars: [[]],
        starts: Uint32Array.from([Q_START]),
        ends: Uint32Array.from([Q_START + 1000]),
        drawCIGAR: true,
        drawCIGARMatchesOnly: true,
        bpPerPx0: BP_PER_PX,
        bpPerPx1: BP_PER_PX,
        viewOff0: 0,
        viewOff1: 0,
        viewWidth: VIEW_W,
      }),
      fadeThinAlignments,
    )
  expect(untiled(true)).toBeLessThan(untiled(false) * 0.9)
})

import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { drawVariantLane } from './drawVariantLane.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'

import type { VariantLaneData } from './drawVariantLane.ts'
import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface FillRectCall {
  x: number
  y: number
  w: number
  h: number
  fillStyle: string
}

function mockCtx() {
  const calls: FillRectCall[] = []
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ x, y, w, h, fillStyle: this.fillStyle })
    },
  }
  return { ctx: ctx as unknown as Ctx2D, calls }
}

// 100bp over 1000px => 10px/bp.
const block: VariantRenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const RED = cssColorToABGR('red')
const BLUE = cssColorToABGR('blue')

// Two records: 10-12bp and 50-51bp, one red and one blue. Per-feature arrays
// only — the lane never reads a cell array, which is what keeps it independent
// of sample count.
function data(overrides?: Partial<VariantLaneData>): VariantLaneData {
  return {
    featurePositions: Uint32Array.from([10, 12, 50, 51]),
    featureInsertedBp: Int32Array.from([0, 0]),
    featureColors: Uint32Array.from([RED, BLUE]),
    featureShapeTypes: Uint8Array.from([SHAPE_RECT, SHAPE_RECT]),
    ...overrides,
  }
}

function draw(laneHeight: number, overrides?: Partial<VariantLaneData>) {
  const { ctx, calls } = mockCtx()
  drawVariantLane(ctx, new Map([[0, data(overrides)]]), [block], {
    canvasWidth: 1000,
    laneHeight,
  })
  return calls
}

test('one mark per record, at its genomic span and in its own color', () => {
  const calls = draw(20)

  expect(calls).toHaveLength(2)
  // 10bp at 10px/bp
  expect(calls[0]).toMatchObject({ x: 100, w: 20, y: 0, h: 20 })
  expect(calls[0]!.fillStyle).toBe(abgrToCssRgba(RED))
  expect(calls[1]).toMatchObject({ x: 500, w: 10, y: 0, h: 20 })
  expect(calls[1]!.fillStyle).toBe(abgrToCssRgba(BLUE))
})

// The band is the only thing that says how tall a mark is: the lane does not
// scroll and has no row pitch to take one from.
test('marks fill the band height', () => {
  expect(draw(8).every(c => c.y === 0 && c.h === 8)).toBe(true)
})

// The model already declines to hand over regions when the band is off, so this
// is the painter's own backstop — a zero-height fillRect is invisible but a
// zero-height *clip* is not obviously a no-op, and the walk is O(features).
test('a zero-height band paints nothing at all', () => {
  expect(draw(0)).toHaveLength(0)
})

// Two records at the same locus in the same color is the common case (a
// callset with no `featureColor` override is every record in one color), and
// the fillStyle assignment is skipped for the second.
test('a run of one color assigns fillStyle once', () => {
  const { ctx, calls } = mockCtx()
  let assignments = 0
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => 'x',
    set: () => {
      assignments++
    },
  })
  drawVariantLane(
    ctx,
    new Map([[0, data({ featureColors: Uint32Array.from([RED, RED]) })]]),
    [block],
    { canvasWidth: 1000, laneHeight: 20 },
  )

  expect(calls).toHaveLength(2)
  expect(assignments).toBe(1)
})

// A sub-pixel record still draws. At a whole-chromosome zoom every SNP is far
// under a pixel wide, and a variant lane that silently drops records is worse
// than one that overplots — the same reasoning as `SvgRowLabels`' floored
// swatch.
test('a sub-pixel record draws at the 1px floor', () => {
  const calls = draw(20, {
    // 0.02bp: 0.2px at this zoom
    featurePositions: Uint32Array.from([10, 10, 50, 51]),
  })

  expect(calls[0]!.w).toBeGreaterThanOrEqual(1)
})

// An insertion consumes no reference, so its span is the 1bp VCF convention
// whatever it inserts. The lane widens it exactly as the cells below are
// widened (`variantCellSpanPx`), so the two cannot disagree about where the
// record is or how big it looks.
test('an insertion widens past its reference span', () => {
  const plain = draw(20, {
    featurePositions: Uint32Array.from([10, 11, 50, 51]),
  })
  const inserted = draw(20, {
    featurePositions: Uint32Array.from([10, 11, 50, 51]),
    featureInsertedBp: Int32Array.from([65481, 0]),
  })

  expect(inserted[0]!.w).toBeGreaterThan(plain[0]!.w)
  // centered on the locus, as the marker under it is
  expect(inserted[0]!.x + inserted[0]!.w / 2).toBeCloseTo(105)
  // the record that inserts nothing is untouched
  expect(inserted[1]).toMatchObject(plain[1]!)
})

// The glyph vocabulary is the cells' (`drawVariantShape`), so an inversion is
// the same left-pointing triangle in the lane as in every row under it. A
// triangle is a path, not a fillRect, which is what this reads off the mock.
test('an inversion draws the cells own triangle glyph, not a rect', () => {
  const { ctx, calls } = mockCtx()
  const path: string[] = []
  Object.assign(ctx, {
    beginPath: () => path.push('begin'),
    moveTo: () => path.push('moveTo'),
    lineTo: () => path.push('lineTo'),
    closePath: () => path.push('closePath'),
    fill: () => path.push('fill'),
  })
  drawVariantLane(
    ctx,
    new Map([
      [
        0,
        data({
          featureShapeTypes: Uint8Array.from([SHAPE_TRI_LEFT, SHAPE_RECT]),
        }),
      ],
    ]),
    [block],
    { canvasWidth: 1000, laneHeight: 20 },
  )

  // the rect record still went through fillRect
  expect(calls).toHaveLength(1)
  // `forEachClippedBlock` opens the block scissor with its own beginPath, so
  // the triangle is what follows the last one rather than the whole trace
  expect(path.slice(path.lastIndexOf('begin'))).toEqual([
    'begin',
    'moveTo',
    'lineTo',
    'lineTo',
    'closePath',
    'fill',
  ])
})

// A region the fetch hasn't reached yet is not an empty lane to paint, it is a
// region to skip: `forEachClippedBlock`'s selector drops it before any clip is
// pushed.
test('a region with no records is skipped', () => {
  const { ctx, calls } = mockCtx()
  drawVariantLane(
    ctx,
    new Map([
      [
        0,
        data({
          featurePositions: new Uint32Array(0),
          featureInsertedBp: new Int32Array(0),
          featureColors: new Uint32Array(0),
        }),
      ],
    ]),
    [block],
    { canvasWidth: 1000, laneHeight: 20 },
  )

  expect(calls).toHaveLength(0)
})

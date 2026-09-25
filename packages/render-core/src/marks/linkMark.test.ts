import { clipBlock } from '../blockClipUtils.ts'
import {
  LINK_NO_REGION,
  LINK_NO_SIZE,
  LINK_STEM_PX,
} from '../shaders/linkMark.consts.generated.ts'
import * as iface from '../shaders/linkMark.iface.generated.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { linkMark } from './linkMark.ts'
import { shapeHitNearest } from './markHit.ts'

import type { LinkChannels, LinkParams, LinkRegion } from './linkMark.ts'

const RED = 0xff0000ff
const BLUE = 0xffff0000

// Two displayed regions side by side: region 0 is bp 0..1000 over px 0..1000,
// region 1 is bp 5000..6000 over px 1000..2000. The block draws region 0.
const regions: LinkRegion[] = [
  { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
  { anchorPx: 1000, anchorBp: 5000, signedPxPerBp: 1 },
]

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 2000, canvasHeight: 100 }

const params: LinkParams = {
  domain: [0, 10],
  regions,
  linkShape: 'dome',
  valued: false,
  sizePx: 2,
}

function channels(
  rows: {
    x: number
    x2: number
    region?: number
    y?: number
    size?: number
    color?: number
  }[],
  lanes: { y?: boolean; size?: boolean } = {},
): LinkChannels {
  return {
    x: Uint32Array.from(rows, r => r.x),
    x2: Uint32Array.from(rows, r => r.x2),
    x2Region: Uint32Array.from(rows, r => r.region ?? 0),
    ...(lanes.y ? { y: Float32Array.from(rows, r => r.y ?? 0) } : {}),
    ...(lanes.size
      ? { size: Float32Array.from(rows, r => r.size ?? NaN) }
      : {}),
    color: Uint32Array.from(rows, r => r.color ?? RED),
    count: rows.length,
  }
}

const hit = shapeHitNearest(linkMark)!

function hitAt(c: LinkChannels, x: number, y: number, p = params) {
  return hit(
    c,
    block,
    frame,
    p,
    x,
    y,
    Array.from({ length: c.count }, (_, i) => i),
    Infinity,
  )
}

test('a dome is a half-ellipse from foot to foot, its apex the half-width clamped to the band', () => {
  const c = channels([
    { x: 100, x2: 200 },
    { x: 300, x2: 700 },
  ])
  // 100 px wide: rx 50, ry 50, a semicircle inside the 100 px band, padded
  // by half the 2 px stroke on every side
  expect(linkMark.ink!(c, block, frame, params, 0)).toEqual({
    left: 99,
    top: 49,
    width: 102,
    height: 52,
  })
  // 400 px wide: rx 200, ry clamped to the band's 100
  expect(linkMark.ink!(c, block, frame, params, 1)).toEqual({
    left: 299,
    top: -1,
    width: 402,
    height: 102,
  })
})

test('an arc is a true semicircle that may leave the band', () => {
  const c = channels([{ x: 300, x2: 700 }])
  expect(
    linkMark.ink!(c, block, frame, { ...params, linkShape: 'arc' }, 0),
  ).toMatchObject({ top: -101, height: 202 })
})

test('a valued link puts its apex at the value on the band scale', () => {
  const c = channels([{ x: 100, x2: 200, y: 5 }], { y: true })
  expect(
    linkMark.ink!(c, block, frame, { ...params, valued: true }, 0),
  ).toMatchObject({ top: 49, height: 52 })
  // inset 10: the value range runs from 10 px above the baseline to 10 px
  // below the band top, so the mid value stands 50 px up as before and the
  // domain's floor 10 px up
  expect(
    linkMark.ink!(c, block, frame, { ...params, valued: true, insetPx: 10 }, 0),
  ).toMatchObject({ top: 49, height: 52 })
  expect(
    linkMark.ink!(
      channels([{ x: 100, x2: 200, y: 0 }], { y: true }),
      block,
      frame,
      { ...params, valued: true, insetPx: 10 },
      0,
    ),
  ).toMatchObject({ top: 89, height: 12 })
})

test('a mate on another displayed region places through that region', () => {
  const c = channels([{ x: 900, x2: 5100, region: 1 }])
  // foot at px 900, mate at px 1100: a 200 px dome centred on the seam
  expect(linkMark.ink!(c, block, frame, params, 0)).toEqual({
    left: 899,
    top: -1,
    width: 202,
    height: 102,
  })
})

test('a mate on no region draws a stem at the placed foot', () => {
  const c = channels([{ x: 500, x2: 42, region: LINK_NO_REGION }])
  expect(linkMark.ink!(c, block, frame, params, 0)).toEqual({
    left: 499,
    top: 100 - LINK_STEM_PX - 1,
    width: 2,
    height: LINK_STEM_PX + 2,
  })
  const near = hitAt(c, 500, 95)
  expect(near).toMatchObject({ index: 0, distSq: 0 })
  expect(hitAt(c, 504, 95)!.distSq).toBeCloseTo(9)
})

test('the size lane strokes each link through the size scale, and no number takes the thinnest', () => {
  const c = channels(
    [
      { x: 100, x2: 200, size: 0 },
      { x: 300, x2: 400, size: 100 },
      { x: 500, x2: 600 },
    ],
    { size: true },
  )
  const scaled: LinkParams = {
    ...params,
    sizeScale: { domain: [0, 100], scale: 'linear', range: [2, 10] },
  }
  const widths = [0, 1, 2].map(
    i => linkMark.ink!(c, block, frame, scaled, i)!.height - 50,
  )
  expect(widths).toEqual([2, 10, 2])
})

test('a far pair degenerates to legs rising from each foot', () => {
  // px 100 to px 8100: 8000 px apart on a 2000 px view, past three widths
  const c = channels([{ x: 100, x2: 5000 + 7100, region: 1 }])
  const ink = linkMark.ink!(c, block, frame, params, 0)!
  expect(ink.left).toBe(99)
  expect(ink.width).toBeCloseTo(8002)
  // the legs reach the band top plus half the stroke, so the butt cut lands
  // outside the band, not the circle's apex thousands of px up
  expect(ink.top).toBeCloseTo(-2)
  const { ctx, calls } = mockCtx()
  linkMark.paintBlock(ctx, c, block, frame, params)
  // two legs, one polyline each, and every recorded edge lies on the band
  expect(calls.length).toBeGreaterThan(2)
  expect(Math.min(...calls.map(r => r.y))).toBeGreaterThanOrEqual(-2.01)
  expect(Math.max(...calls.map(r => r.y + r.h))).toBeLessThan(102)
})

test('the two blocks holding a pair draw it as one curve, whatever their widths', () => {
  const split: LinkRegion[] = [
    { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
    { anchorPx: 1900, anchorBp: 5000, signedPxPerBp: 1 },
  ]
  const wide = { ...block, end: 1900, screenEndPx: 1900 }
  const narrow = {
    ...block,
    displayedRegionIndex: 1,
    start: 5000,
    end: 5100,
    screenStartPx: 1900,
    screenEndPx: 2000,
  }
  const p = { ...params, regions: split }
  const fromWide = linkMark.ink!(
    channels([{ x: 100, x2: 5050, region: 1 }]),
    wide,
    frame,
    p,
    0,
  )
  const fromNarrow = linkMark.ink!(
    channels([{ x: 5050, x2: 100, region: 0 }]),
    narrow,
    frame,
    p,
    0,
  )
  expect(fromNarrow).toEqual(fromWide)
})

test('a block past the region table places its own foot through its own entry', () => {
  const many: LinkRegion[] = Array.from({ length: 301 }, (_, i) => ({
    anchorPx: i * 10,
    anchorBp: i * 10_000 + 123,
    signedPxPerBp: 0.5,
  }))
  const scratch = new ArrayBuffer(iface.UNIFORMS_SIZE_BYTES)
  const own = { ...block, displayedRegionIndex: 300 }
  linkMark.writeUniforms(
    scratch,
    clipBlock(own, frame.canvasWidth, frame.canvasHeight, { x: 1, y: 1 })!,
    own,
    frame,
    { ...params, regions: many },
  )
  const at = iface.UNIFORM_OFFSET_F32.ownEntry
  expect([...new Float32Array(scratch).slice(at, at + 4)]).toEqual([
    3000,
    3_000_123 - (3_000_123 % 4096),
    3_000_123 % 4096,
    0.5,
  ])
})

test('the packed lanes land at the generated offsets', () => {
  const c = channels(
    [
      { x: 10, x2: 20, region: 1, y: 3, size: 7, color: RED },
      { x: 30, x2: 40, region: LINK_NO_REGION, color: BLUE },
    ],
    { y: true, size: true },
  )
  const buf = linkMark.pass.pack(c) as ArrayBuffer
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const s = iface.INSTANCE_STRIDE_WORDS
  const U = iface.INSTANCE_OFFSET_U32
  const F = iface.INSTANCE_OFFSET_F32
  expect(u32[U.x]).toBe(10)
  expect(u32[U.x2]).toBe(20)
  expect(u32[U.x2Region]).toBe(1)
  expect(f32[F.y]).toBe(3)
  expect(f32[F.size]).toBe(7)
  expect(u32[U.color]).toBe(RED)
  expect(u32[s + U.x2Region]).toBe(LINK_NO_REGION)
  expect(f32[s + F.size]).toBe(Math.fround(LINK_NO_SIZE))
  expect(u32[s + U.color]).toBe(BLUE)
})

test('the hit is the nearest point of the stroke, and on the ink it is the cursor', () => {
  const c = channels([{ x: 100, x2: 200 }])
  // the apex of a 100 px semicircle is at (150, 50); the stroke is 2 px
  expect(hitAt(c, 150, 50)).toMatchObject({ index: 0, distSq: 0 })
  const above = hitAt(c, 150, 40)!
  expect(above.y).toBeCloseTo(49)
  expect(above.distSq).toBeCloseTo(81)
  // below the baseline the nearest ink is the nearer foot
  const below = hitAt(c, 190, 110)!
  expect(below.x).toBeCloseTo(200 - Math.sqrt(2) / 2, 1)
  expect(below.distSq).toBeCloseTo((Math.hypot(10, 10) - 1) ** 2, 5)
  // inside the hollow of the dome is not on the ink
  expect(hitAt(c, 150, 90)!.distSq).toBeGreaterThan(30 ** 2)
})

test('later-painted wins on the ink, nearer wins off it', () => {
  const c = channels([
    { x: 100, x2: 200, color: RED },
    { x: 100, x2: 200, color: BLUE },
  ])
  expect(hit(c, block, frame, params, 150, 50, [1, 0], Infinity)).toMatchObject(
    { index: 1 },
  )
  const c2 = channels([
    { x: 100, x2: 200 },
    { x: 400, x2: 500 },
  ])
  expect(hitAt(c2, 452, 60)).toMatchObject({ index: 1 })
})

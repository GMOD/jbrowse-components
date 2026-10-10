import {
  CONNECTOR_ARROW,
  CONNECTOR_BOW,
  CONNECTOR_DASHED,
  CONNECTOR_LEADING_2,
  CONNECTOR_MINUS_2,
  CONNECTOR_STRAIGHT,
} from '../shaders/connectorMark.consts.generated.ts'
import * as iface from '../shaders/connectorMark.iface.generated.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { connectorEnds, connectorMark } from './connectorMark.ts'
import { recordingContext } from './drawAgainstHit.ts'
import { shapeHitNearest } from './markHit.ts'

import type { ConnectorChannels, ConnectorParams } from './connectorMark.ts'
import type { LinkRegion } from './linkMark.ts'

// Region 0 is bp 0..1000 over px 0..1000; region 1 bp 5000..6000 over px
// 1000..2000; region 2 is bp 0..1000 drawn right to left over px 2000..3000.
const regions: LinkRegion[] = [
  { anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 },
  { anchorPx: 1000, anchorBp: 5000, signedPxPerBp: 1 },
  { anchorPx: 3000, anchorBp: 0, signedPxPerBp: -1 },
]

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 3000, canvasHeight: 400 }

const params: ConnectorParams = {
  regions,
  rowOffsetPx: 5,
  rowPitchPx: 10,
  arrowPx: 4,
  strokeDash: [4, 3],
}

interface Row {
  x: number
  x2: number
  region?: number
  row?: number
  row2?: number
  bend?: number
  width?: number
  color?: number
  bits?: number
}

function channels(rows: Row[]): ConnectorChannels {
  return {
    x: Uint32Array.from(rows, r => r.x),
    x2: Uint32Array.from(rows, r => r.x2),
    x2Region: Uint32Array.from(rows, r => r.region ?? 0),
    row: Uint32Array.from(rows, r => r.row ?? 0),
    row2: Uint32Array.from(rows, r => r.row2 ?? 0),
    bend: Float32Array.from(rows, r => r.bend ?? CONNECTOR_BOW),
    width: Float32Array.from(rows, r => r.width ?? 2),
    color: Uint32Array.from(rows, r => r.color ?? 0xcc0000ff),
    bits: Uint8Array.from(rows, r => r.bits ?? 0),
    count: rows.length,
  }
}

// The cubic's four points off the ink's own path.
function cubicOf(c: ConnectorChannels, i = 0) {
  const d = connectorMark.ink!(c, block, frame, params, i)!.stroke!.d
  const [x0, y0, x1, y1, x2, y2, x3, y3] =
    /^M(\S+) (\S+)C(\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/
      .exec(d)!
      .slice(1)
      .map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
  return { x0, y0, x1, y1, x2, y2, x3, y3 }
}

const hit = shapeHitNearest(connectorMark)!

function hitAt(c: ConnectorChannels, x: number, y: number) {
  return hit(c, block, frame, params, x, y, [0], 25)
}

test('the ends stand at their rows centres, the far one placed through its own region', () => {
  const p = cubicOf(
    channels([{ x: 100, x2: 5200, region: 1, row: 2, row2: 7 }]),
  )
  expect([p.x0, p.y0, p.x3, p.y3]).toEqual([100, 25, 1200, 75])
})

test('a forward pair leaves each end along its read and bows up over a shared row', () => {
  const p = cubicOf(channels([{ x: 100, x2: 400 }]))
  expect(p.x1).toBeGreaterThan(p.x0)
  expect(p.x2).toBeGreaterThan(p.x3)
  expect(p.y1).toBeLessThan(p.y0)
  expect(p.y1).toBe(p.y2)
})

test('a dip drops both controls by 4/3 of its depth, and a leading end flips its handle', () => {
  const p = cubicOf(
    channels([{ x: 100, x2: 400, bend: 30, bits: CONNECTOR_LEADING_2 }]),
  )
  expect(p.y1 - p.y0).toBeCloseTo(40)
  expect(p.x2).toBeLessThan(p.x3)
})

test('a reverse strand and a reversed region each flip the far handle, and together cancel', () => {
  const minus = cubicOf(
    channels([{ x: 100, x2: 400, bits: CONNECTOR_MINUS_2 }]),
  )
  expect(minus.x2).toBeLessThan(minus.x3)
  const onReversed = cubicOf(
    channels([{ x: 100, x2: 600, region: 2, bits: CONNECTOR_MINUS_2 }]),
  )
  expect(onReversed.x3).toBe(2400)
  expect(onReversed.x2).toBeGreaterThan(onReversed.x3)
})

test('a straight connector is its chord', () => {
  const p = cubicOf(
    channels([{ x: 100, x2: 400, row2: 3, bits: CONNECTOR_STRAIGHT }]),
  )
  expect([p.x1, p.y1, p.x2, p.y2]).toEqual([p.x0, p.y0, p.x3, p.y3])
})

test('a far end on no region the table holds draws and answers nothing', () => {
  const c = channels([{ x: 100, x2: 400, region: 9 }])
  expect(connectorMark.ink!(c, block, frame, params, 0)).toBeUndefined()
  expect(connectorEnds(c, block, params, 0)).toBeUndefined()
  const { ctx, strokes } = paint(c)
  expect(strokes).toBe(0)
  void ctx
})

function paint(c: ConnectorChannels) {
  const { ctx } = recordingContext()
  const dashes: number[][] = []
  const styles: string[] = []
  let strokes = 0
  const spy = Object.assign(ctx, {
    setLineDash(d: number[]) {
      dashes.push(d)
    },
    stroke() {
      strokes++
      styles.push(String(spy.strokeStyle))
    },
  })
  connectorMark.paintBlock(spy, c, block, frame, params)
  return { ctx: spy, dashes, styles, strokes }
}

test('the painter strokes in the instance color with its alpha, dashing only a dashed one', () => {
  const { dashes, styles } = paint(
    channels([
      { x: 100, x2: 400, color: 0xcc0000ff },
      { x: 100, x2: 400, bits: CONNECTOR_DASHED },
    ]),
  )
  expect(styles[0]).toBe(abgrToCssRgba(0xcc0000ff))
  expect(dashes.slice(0, 2)).toEqual([[], [4, 3]])
})

test('an arrowhead strokes its two arms at the far end', () => {
  const { strokes } = paint(
    channels([{ x: 100, x2: 400, bits: CONNECTOR_ARROW }]),
  )
  expect(strokes).toBe(2)
})

test('a connector with both ends far off the canvas paints nothing', () => {
  const { strokes } = paint(
    channels([{ x: 100, x2: 400, row: 500, row2: 500 }]),
  )
  expect(strokes).toBe(0)
})

test('the hit is on the stroke, near it within the slop, and not past it', () => {
  const c = channels([
    { x: 100, x2: 400, row: 10, row2: 10, bits: CONNECTOR_STRAIGHT },
  ])
  expect(hitAt(c, 250, 105)?.distSq).toBe(0)
  expect(hitAt(c, 250, 108)?.distSq).toBeCloseTo(4)
  expect(hitAt(c, 250, 120)).toBeUndefined()
})

test('the arrowhead answers a hover on its arm', () => {
  const c = channels([
    {
      x: 100,
      x2: 400,
      row: 10,
      row2: 10,
      bits: CONNECTOR_STRAIGHT | CONNECTOR_ARROW,
    },
  ])
  // the arms run from (396, 101) and (396, 109) to the tip at (400, 105)
  expect(hitAt(c, 398, 103)?.distSq).toBe(0)
})

test('connectorEnds names both ends in canvas px', () => {
  const c = channels([{ x: 100, x2: 5200, region: 1, row: 1, row2: 2 }])
  expect(connectorEnds(c, block, params, 0)).toEqual({
    x: 100,
    y: 15,
    x2: 1200,
    y2: 25,
  })
})

test('the packed lanes land at the generated offsets', () => {
  const c = channels([
    {
      x: 7,
      x2: 9,
      region: 1,
      row: 3,
      row2: 4,
      bend: 12.5,
      width: 1.5,
      color: 0xff00ff00,
      bits: 37,
    },
  ])
  const buf = connectorMark.pass.pack(c) as ArrayBuffer
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const U = iface.INSTANCE_OFFSET_U32
  const F = iface.INSTANCE_OFFSET_F32
  expect([
    u32[U.x],
    u32[U.x2],
    u32[U.x2Region],
    u32[U.row],
    u32[U.row2],
  ]).toEqual([7, 9, 1, 3, 4])
  expect([f32[F.bend], f32[F.width]]).toEqual([12.5, 1.5])
  expect([u32[U.color], u32[U.bits]]).toEqual([0xff00ff00, 37])
})

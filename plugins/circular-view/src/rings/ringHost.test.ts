import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { calculateStaticSlices } from '../CircularView/slices.ts'
import {
  MAX_RINGS_RADIUS_FRACTION,
  RingHost,
  RING_AXIS_LABEL_GAP_PX,
  RING_GAP_PX,
  layoutRings,
  ringAxisTicks,
  ringHit,
  stripBlocks,
} from './ringHost.ts'
import { RING_PASSES, ringMarks } from './ringMarks.ts'
import { ringShape } from './ringShape.ts'

import type { RingDisplay, RingHostView } from './ringHost.ts'
import type { RingCell, RingFrame } from './ringMarks.ts'

const TWO_PI = 2 * Math.PI

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const region = (refName: string, end: number) => ({
  refName,
  start: 0,
  end,
  assemblyName: 'volvox',
  widthBp: end,
  elided: false as const,
})

// three drawn slices with an elided run of two tiny contigs between the
// second and third, at 10 bp per radian and a 5 px gap on a 100 px radius
const slices = calculateStaticSlices({
  elidedRegions: [
    region('ctgA', 100),
    region('ctgB', 50),
    {
      elided: true,
      widthBp: 4,
      regions: [
        { refName: 'ctgC', start: 0, end: 2, assemblyName: 'volvox' },
        { refName: 'ctgD', start: 0, end: 2, assemblyName: 'volvox' },
      ],
    },
    region('ctgE', 30),
  ],
  bpPerRadian: 10,
  spacingPx: 5,
  radiusPx: 100,
})

test('the strip lays one block per slice at the slice arc, and an elided run counts its regions', () => {
  const blocks = stripBlocks(slices, 100)
  expect(blocks.blocks.map(b => b.type)).toEqual([
    'ContentBlock',
    'ContentBlock',
    'ElidedBlock',
    'ContentBlock',
  ])
  const content = blocks.contentBlocks
  expect(content.map(b => b.displayedRegionIndex)).toEqual([0, 1, 4])
  for (const [i, block] of blocks.blocks.entries()) {
    const slice = slices[i]!
    expect(block.offsetPx).toBeCloseTo(slice.startRadians * 100)
    expect(block.widthPx).toBeCloseTo(
      (slice.endRadians - slice.startRadians) * 100,
    )
  }
  expect(content[1]!.offsetPx - content[0]!.widthPx).toBeCloseTo(5)
  expect(blocks.totalBp).toBe(180)
  // the strip scale shrinks every offset with it
  expect(stripBlocks(slices, 50).blocks[3]!.offsetPx).toBeCloseTo(
    blocks.blocks[3]!.offsetPx / 2,
  )
})

// A link's feet place through these, so a gap the strip lays between slices
// they miss lands every foot past the first slice short.
test('each displayed region starts on the strip where its slice does', () => {
  const host = RingHost.create({})
  host.setView({
    staticSlices: slices,
    radiusPx: 100,
    circumferencePx: TWO_PI * 100,
    bpPerPx: 0.1,
  } as unknown as RingHostView)
  const offsets = host.displayedRegionOffsetsPx
  const blocks = stripBlocks(slices, 100)
  expect(offsets).toHaveLength(5)
  for (const block of blocks.contentBlocks) {
    expect(offsets[block.displayedRegionIndex!]).toBeCloseTo(block.offsetPx)
  }
  const elided = blocks.blocks[2]!
  expect(offsets[2]).toBeCloseTo(elided.offsetPx)
  expect(offsets[3]).toBeCloseTo(elided.offsetPx + 2 / 0.1)
})

const display = (id: string, height: number): RingDisplay => ({
  id,
  type: 'LinearWiggleDisplay',
  height,
  paintCount: 0,
  painted: false,
  renderNow() {},
  setHostHeight() {},
  configuration: { displayId: id },
  RenderingComponent: () => null,
})

test('rings stack inward from the ruler, each its display height, a gap between', () => {
  const rings = layoutRings([display('a', 100), display('b', 40)], 500)
  expect(rings.map(r => [r.outerPx, r.innerPx])).toEqual([
    [500 - RING_GAP_PX, 500 - RING_GAP_PX - 100],
    [500 - 2 * RING_GAP_PX - 100, 500 - 2 * RING_GAP_PX - 140],
  ])
})

// two default-height rings on a small circle used to take the whole interior,
// leaving the ribbons a dot
test('rings past half the radius shrink in proportion, keeping the interior', () => {
  const rings = layoutRings([display('a', 100), display('b', 50)], 150)
  const bands = rings.map(r => r.outerPx - r.innerPx)
  expect(bands[0]! / bands[1]!).toBeCloseTo(2)
  expect(rings[1]!.innerPx).toBeCloseTo(75)
})

// four rings at the zoom floor leave the gaps more than the half-radius the
// rings may take, so every band came out zero wide: the Canvas2D painter drew
// nothing and the GPU pass divided by the band and sampled the strip at NaN
test('a circle with no room left for a band lays out no ring', () => {
  const four = ['a', 'b', 'c', 'd'].map(id => display(id, 100))
  expect(layoutRings(four, 25)).toEqual([])
  const bands200 = layoutRings(four, 200).map(r => r.outerPx - r.innerPx)
  expect(bands200).toHaveLength(4)
  for (const band of bands200) {
    expect(band).toBeCloseTo((200 * MAX_RINGS_RADIUS_FRACTION - 16) / 4)
  }
  const eight = Array.from({ length: RING_PASSES }, (_, i) =>
    display(`d${i}`, 100),
  )
  expect(layoutRings(eight, 64)).toEqual([])
  for (const ring of layoutRings(eight, 500)) {
    expect(ring.outerPx - ring.innerPx).toBeGreaterThan(0)
  }
})

// every height zero used to divide zero by zero and put NaN radii in the
// instance buffer, and a zero-height display among sized ones a zero band
test('a display with no height takes no ring, and leaves the rest sized', () => {
  expect(layoutRings([display('a', 0), display('b', 0)], 10)).toEqual([])
  expect(
    layoutRings([display('a', 0), display('b', 100)], 500).map(r => [
      r.display.id,
      r.outerPx - r.innerPx,
    ]),
  ).toEqual([['b', 100]])
})

// the strip is still drawn at the display's height, so a point on a shrunk
// ring unwarps to the strip row the warp put there
test('a point on a shrunk ring unwarps to its strip row', () => {
  const [ring] = layoutRings([display('a', 300)], 200)
  const band = ring!.outerPx - ring!.innerPx
  const r = ring!.outerPx - band / 2
  const hit = ringHit([ring!], r, 0, 0, 200)!
  expect(hit.y).toBeCloseTo(150)
})

test('a point on a ring unwarps to the strip x its angle covers and the y from the outer rim', () => {
  const rings = layoutRings([display('a', 100), display('b', 40)], 500)
  const stripRadius = 500
  const offset = -Math.PI / 2
  const [outerRing, innerRing] = rings
  // the inner ring, a quarter turn past the strip's start, ten px in
  const r = innerRing!.outerPx - 10
  const a = Math.PI / 2 + offset
  const hit = ringHit(
    rings,
    r * Math.cos(a),
    r * Math.sin(a),
    offset,
    stripRadius,
  )!
  expect(hit.ring).toBe(innerRing)
  expect(hit.x).toBeCloseTo((Math.PI / 2) * stripRadius)
  expect(hit.y).toBeCloseTo(10)
  // the outer ring at the same angle, and the gap between them answers nothing
  expect(
    ringHit(
      rings,
      outerRing!.outerPx * Math.cos(a),
      outerRing!.outerPx * Math.sin(a),
      offset,
      stripRadius,
    )?.ring,
  ).toBe(outerRing)
  const gap = (outerRing!.innerPx + innerRing!.outerPx) / 2
  expect(
    ringHit(rings, gap * Math.cos(a), gap * Math.sin(a), offset, stripRadius),
  ).toBeUndefined()
  // just before the strip's start is the strip's end, never a negative x
  const back = ringHit(
    rings,
    r * Math.cos(offset - 0.01),
    r * Math.sin(offset - 0.01),
    offset,
    stripRadius,
  )!
  expect(back.x).toBeCloseTo((TWO_PI - 0.01) * stripRadius)
})

const canvas = () => {
  const c = document.createElement('canvas')
  c.width = 2000
  c.height = 100
  return c
}

function canvas2d(width: number, height: number) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return { canvas: c, ctx: c.getContext('2d')! }
}

test('the Canvas2D painter draws a translucent strip at its own alpha, each column where ringHit unwarps it', () => {
  const strip = canvas2d(2000, 100)
  strip.ctx.fillStyle = 'rgba(0, 0, 255, 0.5)'
  strip.ctx.fillRect(0, 0, 1000, 100)
  strip.ctx.fillStyle = 'rgb(255, 0, 0)'
  strip.ctx.fillRect(1000, 0, 1000, 100)
  const target = canvas2d(1000, 1000)
  const offset = 0.7
  ringShape('ring0').paintBlock(
    target.ctx,
    { innerPx: Float32Array.of(300), outerPx: Float32Array.of(400), count: 1 },
    canvasWideBlocks([0], 1000)[0]!,
    { canvasWidth: 1000, canvasHeight: 1000 },
    {
      centerX: 500,
      centerY: 500,
      offsetRadians: offset,
      strip: { image: strip.canvas, width: 2000, height: 100 },
    },
  )
  const ring = { display: display('a', 100), innerPx: 300, outerPx: 400 }
  const { data } = target.ctx.getImageData(0, 0, 1000, 1000)
  const seen = { translucent: 0, opaque: 0, outside: 0 }
  const wrong: number[][] = []
  for (let y = 0; y < 1000; y++) {
    for (let x = 0; x < 1000; x++) {
      const dx = x + 0.5 - 500
      const dy = y + 0.5 - 500
      const r = Math.hypot(dx, dy)
      const o = (y * 1000 + x) * 4
      const [red, green, blue, alpha] = data.subarray(o, o + 4)
      const column =
        ((ringHit([ring], dx, dy, offset, 400)?.x ?? 0) / (TWO_PI * 400)) * 2000
      if (r < 299 || r > 401) {
        seen.outside++
        if (alpha !== 0) {
          wrong.push([x, y, alpha!])
        }
      } else if (r > 301 && r < 399 && column > 2 && column < 998) {
        seen.translucent++
        if (blue !== 255 || red !== 0 || Math.abs(alpha! - 128) > 1) {
          wrong.push([x, y, red!, green!, blue!, alpha!])
        }
      } else if (r > 301 && r < 399 && column > 1002 && column < 1998) {
        seen.opaque++
        if (red !== 255 || blue !== 0 || alpha !== 255) {
          wrong.push([x, y, red!, green!, blue!, alpha!])
        }
      }
    }
  }
  expect(wrong.slice(0, 5)).toEqual([])
  expect(seen.translucent).toBeGreaterThan(100_000)
  expect(seen.opaque).toBeGreaterThan(100_000)
  expect(seen.outside).toBeGreaterThan(100_000)
})

test('the painter draws nothing without a strip', () => {
  const shape = ringShape('ring0')
  const target = canvas2d(10, 10)
  const params = { centerX: 5, centerY: 5, offsetRadians: 0, strip: undefined }
  expect(
    shape.paintsBlock!(
      canvasWideBlocks([0], 10)[0]!,
      { canvasWidth: 10, canvasHeight: 10 },
      params,
    ),
  ).toBe(false)
  shape.paintBlock(
    target.ctx,
    { innerPx: Float32Array.of(1), outerPx: Float32Array.of(4), count: 1 },
    canvasWideBlocks([0], 10)[0]!,
    { canvasWidth: 10, canvasHeight: 10 },
    params,
  )
  expect(target.ctx.getImageData(0, 0, 10, 10).data.every(v => v === 0)).toBe(
    true,
  )
})

const frame: RingFrame = {
  canvasWidth: 1000,
  canvasHeight: 1000,
  centerX: 500,
  centerY: 500,
  offsetRadians: 0,
}

function cell(index: number, image: HTMLCanvasElement): RingCell {
  return {
    index,
    display: { paintCount: 0, renderNow() {} },
    paintCount: 0,
    channels: {
      innerPx: Float32Array.of(300),
      outerPx: Float32Array.of(400),
      count: 1,
    },
    strip: { image, width: image.width, height: image.height },
  }
}

test('on the GPU each ring is its own pass, sampling its strip canvas, re-copied only when the strip repaints', () => {
  const hal = new MockHal(ringMarks.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, ringMarks)
  const a = canvas()
  const b = canvas()
  const cells = new Map([
    [0, cell(0, a)],
    [1, cell(1, b)],
  ])
  backend.upload(0, cells.get(0)!)
  backend.upload(1, cells.get(1)!)
  // an empty pack is a release, so the seven other passes upload nothing
  expect(
    hal
      .callsOf('uploadBuffer')
      .filter(c => c.args[3] !== 0)
      .map(c => c.args.slice(0, 2)),
  ).toEqual([
    [0, 'ring0'],
    [1, 'ring1'],
  ])
  const blocks = canvasWideBlocks(cells.keys(), frame.canvasWidth)
  expect(backend.renderBlocks(blocks, cells, frame)).toBe(true)
  // the two rings copy their strips, and the six passes with no ring draw
  // nothing, so bind nothing
  const copies = () =>
    hal.callsOf('uploadTexture').filter(c => c.args[1] === 'canvas')
  expect(copies().map(c => c.args)).toEqual([
    ['ring0', 'canvas', 2000, 100, 'strip'],
    ['ring1', 'canvas', 2000, 100, 'strip'],
  ])
  expect(hal.getTexture('ring0')).toBe(a)
  expect(hal.getTexture('ring1')).toBe(b)
  expect(hal.draws().map(d => d.passId)).toEqual(['ring0', 'ring1'])

  // a frame with the same strips copies nothing; a repainted strip copies once
  backend.renderBlocks(blocks, cells, frame)
  expect(copies()).toHaveLength(2)
  cells.set(1, cell(1, b))
  backend.renderBlocks(blocks, cells, frame)
  expect(copies().map(c => c.args[0])).toEqual(['ring0', 'ring1', 'ring1'])
})

test('the ring pass writes the frame it samples in', () => {
  const hal = new MockHal(ringMarks.map(m => m.pass))
  const backend = new GpuMarkBackend(hal, ringMarks)
  const cells = new Map([[0, cell(0, canvas())]])
  backend.upload(0, cells.get(0)!)
  backend.renderBlocks(canvasWideBlocks([0], 1000), cells, {
    ...frame,
    offsetRadians: 1.25,
  })
  const [u] = hal.getUniformWritesF32()
  expect([...u!.slice(0, 6)]).toEqual([500, 500, 1000, 1000, 1.25, 1])
  expect(RING_PASSES).toBe(ringMarks.length)
})

// the axis is the strip's, warped the way the ring is: a tick's strip row lands
// at the radius that row is drawn at, and crowded labels drop out
test("a ring's axis ticks sit at the radii their strip rows are warped to", () => {
  const axes = [
    {
      ticks: {
        items: [
          { value: 10, y: 0 },
          { value: 9, y: 10 },
          { value: 5, y: 150 },
          { value: 0, y: 300 },
        ],
      },
    },
  ]
  const [ring] = layoutRings([{ ...display('a', 300), axes } as never], 200)
  const band = ring!.outerPx - ring!.innerPx
  const ticks = ringAxisTicks(ring!)
  expect(ticks.map(t => t.radius)).toEqual([
    ring!.outerPx,
    ring!.outerPx - (10 * band) / 300,
    ring!.outerPx - band / 2,
    ring!.innerPx,
  ])
  expect((10 * band) / 300).toBeLessThan(RING_AXIS_LABEL_GAP_PX)
  expect(ticks.map(t => t.label)).toEqual(['10', undefined, '5', '0'])
})

test('a stacked scale draws no ring axis', () => {
  const axes = [{ bandTops: [0, 50], ticks: { items: [{ value: 1, y: 0 }] } }]
  const [ring] = layoutRings([{ ...display('a', 100), axes } as never], 500)
  expect(ringAxisTicks(ring!)).toEqual([])
})

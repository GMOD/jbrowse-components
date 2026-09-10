import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import { calculateStaticSlices } from '../CircularView/slices.ts'
import { RING_GAP_PX, layoutRings, ringHit, stripBlocks } from './ringHost.ts'
import { RING_PASSES, ringMarks } from './ringMarks.ts'
import { SLICE_ARC_PX, ringShape } from './ringShape.ts'

import type { RingDisplay } from './ringHost.ts'
import type { RingCell, RingFrame } from './ringMarks.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

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

const display = (id: string, height: number): RingDisplay => ({
  id,
  type: 'LinearWiggleDisplay',
  height,
  paintCount: 0,
  renderNow() {},
  configuration: { displayId: id },
  RenderingComponent: () => null,
})

test('rings stack inward from the ruler, each its display height, a gap between', () => {
  const rings = layoutRings([display('a', 100), display('b', 40)], 500)
  expect(rings.map(r => [r.outerPx, r.innerPx])).toEqual([
    [500 - RING_GAP_PX, 500 - RING_GAP_PX - 100],
    [500 - 2 * RING_GAP_PX - 100, 500 - 2 * RING_GAP_PX - 140],
  ])
  expect(
    layoutRings([display('a', 2000), display('b', 1)], 500)[1]!.innerPx,
  ).toBe(0)
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

function recordingContext() {
  const calls: { a: number; sx: number; sw: number; dy: number; dh: number }[] =
    []
  let angle = 0
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    translate() {},
    rotate(a: number) {
      angle += a
    },
    drawImage(
      _image: CanvasImageSource,
      sx: number,
      _sy: number,
      sw: number,
      _sh: number,
      _dx: number,
      dy: number,
      _dw: number,
      dh: number,
    ) {
      calls.push({ a: angle, sx, sw, dy, dh })
    },
  } as unknown as MarkContext2D
  return { ctx, calls }
}

const canvas = () => {
  const c = document.createElement('canvas')
  c.width = 2000
  c.height = 100
  return c
}

test('the Canvas2D painter slices the strip around the ring, and each slice lands where ringHit unwarps it', () => {
  const shape = ringShape('ring0')
  const { ctx, calls } = recordingContext()
  const strip = { image: canvas(), width: 2000, height: 100 }
  const ring = { display: display('a', 100), innerPx: 300, outerPx: 400 }
  const offset = 0.7
  shape.paintBlock(
    ctx,
    { innerPx: Float32Array.of(300), outerPx: Float32Array.of(400), count: 1 },
    canvasWideBlocks([0], 1000)[0]!,
    { canvasWidth: 1000, canvasHeight: 1000 },
    { centerX: 500, centerY: 500, offsetRadians: offset, strip },
  )
  const slices = Math.ceil((TWO_PI * 400) / SLICE_ARC_PX)
  expect(calls).toHaveLength(slices)
  // the slices tile the strip exactly once, top row at the outer rim
  expect(calls[0]!.sx).toBe(0)
  expect(calls.at(-1)!.sx + calls.at(-1)!.sw).toBeCloseTo(2000)
  expect(calls[0]!.dy).toBe(-400)
  expect(calls[0]!.dh).toBe(100)
  // slice s is rotated to sit where the hit test says its strip columns are
  const stripRadius = 400
  for (const s of [0, 7, Math.floor(slices / 2), slices - 1]) {
    const call = calls[s]!
    const a = call.a - Math.PI / 2
    const r = 350
    const hit = ringHit(
      [ring],
      r * Math.cos(a),
      r * Math.sin(a),
      offset,
      stripRadius,
    )!
    const x = (hit.x / (TWO_PI * stripRadius)) * 2000
    expect(x).toBeGreaterThanOrEqual(call.sx - 1e-6)
    expect(x).toBeLessThanOrEqual(call.sx + call.sw + 1e-6)
  }
})

test('the painter draws nothing without a strip', () => {
  const shape = ringShape('ring0')
  const { ctx, calls } = recordingContext()
  const params = { centerX: 0, centerY: 0, offsetRadians: 0, strip: undefined }
  expect(
    shape.paintsBlock!(
      canvasWideBlocks([0], 10)[0]!,
      { canvasWidth: 10, canvasHeight: 10 },
      params,
    ),
  ).toBe(false)
  shape.paintBlock(
    ctx,
    { innerPx: Float32Array.of(1), outerPx: Float32Array.of(2), count: 1 },
    canvasWideBlocks([0], 10)[0]!,
    { canvasWidth: 10, canvasHeight: 10 },
    params,
  )
  expect(calls).toHaveLength(0)
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
  // the six passes with no ring bind the inert table once; the two rings
  // copy their strips
  const copies = () =>
    hal.callsOf('uploadTexture').filter(c => c.args[1] === 'canvas')
  expect(copies().map(c => c.args)).toEqual([
    ['ring0', 'canvas', 2000, 100],
    ['ring1', 'canvas', 2000, 100],
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

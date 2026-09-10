import { barMark } from './barMark.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'

import type { BarChannels, BarParams } from './barMark.ts'
import type { MarkRamp } from './types.ts'

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 1000, canvasHeight: 100 }

// Black at the domain floor, white at its ceiling, over 256 entries.
function greyLut() {
  const lut = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    lut[i * 4] = i
    lut[i * 4 + 1] = i
    lut[i * 4 + 2] = i
    lut[i * 4 + 3] = 255
  }
  return lut
}

const ramp: MarkRamp = { domain: [0, 100], scale: 'linear', lut: greyLut() }

function bars(values: number[]): BarChannels {
  return {
    x: Uint32Array.from(values.map((_, i) => i * 10)),
    x2: Uint32Array.from(values.map((_, i) => i * 10 + 5)),
    y: Float32Array.from(values.map(() => 1)),
    colorValue: Float32Array.from(values),
    count: values.length,
  }
}

const params: BarParams = { domain: [0, 2], origin: 0, minWidthPx: 0, ramp }

test('the colour lane carries the value bits, so a ramp adds no instance byte', () => {
  const c = bars([0, 50, 100])
  const bits = colorBits(c)
  expect(bits.length).toBe(3)
  const copy = Uint32Array.from(bits as Uint32Array)
  const back = new Float32Array(copy.buffer, copy.byteOffset, copy.length)
  expect([...back]).toEqual([0, 50, 100])
  expect(barMark.pass.pack(c).byteLength).toBe(3 * 16)
})

test('a packed colour lane is passed through untouched', () => {
  const c: BarChannels = {
    ...bars([0, 100]),
    colorValue: undefined,
    color: Uint32Array.from([1, 2]),
  }
  expect([...(colorBits(c) as Uint32Array)]).toEqual([1, 2])
  expect([...(paintColors(c, 2, undefined) as Uint32Array)]).toEqual([1, 2])
})

test('the bake reads the LUT at the value fraction, floors and ceilings clamped', () => {
  const c = bars([-10, 0, 50, 100, 200])
  const colors = paintColors(c, 5, ramp) as Uint32Array
  const grey = (v: number) => (0xff000000 | (v << 16) | (v << 8) | v) >>> 0
  expect([...colors]).toEqual([
    grey(0),
    grey(0),
    grey(128),
    grey(255),
    grey(255),
  ])
})

test('an unchanged domain reuses the bake; a widened one redoes it', () => {
  const c = bars([0, 50, 100])
  const first = paintColors(c, 3, ramp)
  expect(paintColors(c, 3, { ...ramp })).toBe(first)
  const widened = paintColors(c, 3, { ...ramp, domain: [0, 200] })
  expect(widened).not.toBe(first)
  expect(widened[1]).not.toBe(first[1])
})

test('a log ramp reads the domain the way the shader does', () => {
  const c = bars([1, 10, 100])
  const linear = paintColors(c, 3, ramp) as Uint32Array
  const log = paintColors(c, 3, {
    ...ramp,
    domain: [1, 100],
    scale: 'log',
  }) as Uint32Array
  // 10 is halfway up a decade ramp and a tenth of the way up a linear one
  expect((log[1]! >>> 0) & 255).toBe(128)
  expect((linear[1]! >>> 0) & 255).toBe(26)
})

test('the ramp reaches the shader as three uniforms and nothing else', () => {
  expect(rampUniforms(undefined)).toEqual({
    rampMode: 0,
    rampMin: 0,
    rampMax: 1,
  })
  expect(rampUniforms(ramp)).toEqual({
    rampMode: 1,
    rampMin: 0,
    rampMax: 100,
  })
  expect(rampUniforms({ ...ramp, scale: 'log' }).rampMode).toBe(2)
})

test('the painter fills the baked colours, batching a run of one', () => {
  const { ctx, calls } = mockCtx()
  barMark.paintBlock(ctx, bars([100, 100, 0]), block, frame, params)
  const grey = (v: number) =>
    abgrToCssRgba((0xff000000 | (v << 16) | (v << 8) | v) >>> 0)
  expect(calls.map(c => c.fillStyle)).toEqual([grey(255), grey(255), grey(0)])
})

import { INSTANCE_STRIDE_BYTES } from '../shaders/barMark.generated.ts'
import { GLSL_VERTEX as BAR_GLSL } from '../shaders/barMark.glsl.generated.ts'
import { WGSL_SOURCE as BAR_WGSL } from '../shaders/barMark.wgsl.generated.ts'
import { GLSL_VERTEX as LINK_GLSL } from '../shaders/linkMark.glsl.generated.ts'
import { WGSL_SOURCE as LINK_WGSL } from '../shaders/linkMark.wgsl.generated.ts'
import {
  RAMP_NOT_A_NUMBER_COLOR,
  RAMP_NO_VALUE_BITS,
  RAMP_NO_VALUE_COLOR,
} from '../shaders/markColor.generated.ts'
import { GLSL_VERTEX as POINT_GLSL } from '../shaders/pointMark.glsl.generated.ts'
import { WGSL_SOURCE as POINT_WGSL } from '../shaders/pointMark.wgsl.generated.ts'
import { barMark } from './barMark.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { recordingContext as mockCtx } from './drawAgainstHit.ts'
import {
  colorBits,
  keepRampValues,
  paintColors,
  rampUniforms,
  rampValueBits,
} from './markRamp.ts'

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

const params: BarParams = {
  domain: [0, 2],
  origin: 0,
  minWidthPx: 0,
  seamPx: 0,
  ramp,
}

test('the colour lane carries the value bits, so a ramp adds no instance byte', () => {
  const c = bars([0, 50, 100])
  const bits = colorBits(c)
  expect(bits.length).toBe(3)
  const copy = Uint32Array.from(bits as Uint32Array)
  const back = new Float32Array(copy.buffer, copy.byteOffset, copy.length)
  expect([...back]).toEqual([0, 50, 100])
  expect(barMark.pass.pack(c).byteLength).toBe(3 * INSTANCE_STRIDE_BYTES)
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

// What markColor.slang reads off the lane's bits: the value-less payload, any
// other NaN, and an infinity at the end on its side.
test('the bake paints no value, text and infinities as the shader does', () => {
  const c = bars([0, Number.NaN, 10, Infinity, -Infinity])
  rampValueBits(c.colorValue!)[0] = RAMP_NO_VALUE_BITS
  const colors = paintColors(c, 5, ramp) as Uint32Array
  const grey = (v: number) => (0xff000000 | (v << 16) | (v << 8) | v) >>> 0
  expect([...colors]).toEqual([
    RAMP_NO_VALUE_COLOR,
    RAMP_NOT_A_NUMBER_COLOR,
    grey(26),
    grey(255),
    grey(0),
  ])
})

test('keeping part of a lane keeps the value-less payload bit for bit', () => {
  const values = new Float32Array([1, 0, 3])
  rampValueBits(values)[1] = RAMP_NO_VALUE_BITS
  const kept = keepRampValues(values, (_, i) => i > 0)
  expect(rampValueBits(kept)[0]).toBe(RAMP_NO_VALUE_BITS)
  expect(kept[1]).toBe(3)
})

test('a domain with no range steps: the ceiling above its min, the floor at or below', () => {
  const c = bars([4, 5, 6])
  const grey = (v: number) => (0xff000000 | (v << 16) | (v << 8) | v) >>> 0
  for (const scale of ['linear', 'log'] as const) {
    const colors = paintColors(c, 3, { ...ramp, domain: [5, 5], scale })
    expect([...(colors as Uint32Array)]).toEqual([grey(0), grey(0), grey(255)])
  }
})

test('an unchanged domain reuses the bake; a widened one redoes it', () => {
  const c = bars([0, 50, 100])
  const first = paintColors(c, 3, ramp)
  expect(paintColors(c, 3, { ...ramp })).toBe(first)
  const widened = paintColors(c, 3, { ...ramp, domain: [0, 200] })
  expect(widened).not.toBe(first)
  expect(widened[1]).not.toBe(first[1])
})

// A lane filtered into a copy of its payload, as a hidden facet section is,
// carries the bake the original was painted with.
test('a copy with other values bakes its own', () => {
  const c = bars([0, 50, 100])
  paintColors(c, 3, ramp)
  const kept = { ...c, colorValue: Float32Array.of(100, 0), count: 2 }
  expect([...(paintColors(kept, 2, ramp) as Uint32Array)]).toEqual([
    ...(paintColors(bars([100, 0]), 2, ramp) as Uint32Array),
  ])
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

test('the ramp reaches the shader as four uniforms and nothing else', () => {
  expect(rampUniforms(undefined)).toEqual({
    rampMode: 0,
    rampMin: 0,
    rampMax: 1,
    rampMidNorm: 0.5,
  })
  expect(rampUniforms(ramp)).toEqual({
    rampMode: 1,
    rampMin: 0,
    rampMax: 100,
    rampMidNorm: 0.5,
  })
  expect(rampUniforms({ ...ramp, mid: 25 }).rampMidNorm).toBe(0.25)
  expect(rampUniforms({ ...ramp, scale: 'log' }).rampMode).toBe(2)
})

// The table is straight; a declared middle is where the painter reads it, so
// the value at the middle takes the middle entry and each end its end entry.
test('a declared middle moves where the bake reads the straight table', () => {
  const c = bars([0, 25, 100])
  const colors = paintColors(c, 3, { ...ramp, mid: 25 }) as Uint32Array
  expect([...colors].map(abgr => abgr & 255)).toEqual([85, 128, 255])
  const widened = paintColors(c, 3, {
    ...ramp,
    domain: [0, 200],
    mid: 25,
  }) as Uint32Array
  expect(widened[1]! & 255).toBe(128)
})

test('the painter fills the baked colours, batching a run of one', () => {
  const { ctx, calls } = mockCtx()
  barMark.paintBlock(ctx, bars([100, 100, 0]), block, frame, params)
  const grey = (v: number) =>
    abgrToCssRgba((0xff000000 | (v << 16) | (v << 8) | v) >>> 0)
  expect(calls.map(c => c.fillStyle)).toEqual([grey(255), grey(255), grey(0)])
})

// The Canvas2D bake above reads a declared middle through `rampMidT`; this
// holds the three shapes' emitted shaders to the same read, off the uniform
// `rampUniforms` writes, where the table would otherwise be read straight.
test.each([
  ['bar WGSL', BAR_WGSL],
  ['bar GLSL', BAR_GLSL],
  ['point WGSL', POINT_WGSL],
  ['point GLSL', POINT_GLSL],
  ['link WGSL', LINK_WGSL],
  ['link GLSL', LINK_GLSL],
])('%s reads the ramp through its middle', (_name, src) => {
  expect(src).toMatch(/rampMidT_0\(normalizeScore_0\(/)
  expect(src).toMatch(/markInstanceColor_0\([^;]*u_0\.rampMidNorm_0\)/)
})

import { clipBlock } from '../blockClipUtils.ts'
import * as iface from '../shaders/barMark.iface.generated.ts'
import { barMark } from './barMark.ts'

import type { BarChannels, BarParams } from './barMark.ts'

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}
const frame = { canvasWidth: 1000, canvasHeight: 120 }
const params: BarParams = {
  domain: [0, 10],
  origin: 0,
  minWidthPx: 2,
  seamPx: 0,
  standsOnY2: true,
}

// two stacked bars over one span: the second stands where the first ends
const stacked: BarChannels = {
  x: Uint32Array.from([10, 10]),
  x2: Uint32Array.from([40, 40]),
  y: Float32Array.from([4, 10]),
  y2: Float32Array.from([0, 4]),
  color: Uint32Array.from([0xff0000ff, 0xff00ff00]),
  row: Uint32Array.from([0, 0]),
  count: 2,
}

test('a bar with a y2 lane stands on it, so a stack tiles the band without a gap or an overlap', () => {
  const lower = barMark.ink!(stacked, block, frame, params, 0)!
  const upper = barMark.ink!(stacked, block, frame, params, 1)!
  expect(lower.top + lower.height).toBe(120)
  expect(lower.height).toBeCloseTo(48)
  expect(upper.top + upper.height).toBeCloseTo(lower.top)
  expect(upper.top).toBeCloseTo(0)
})

test('the packer carries y2 as its own attribute and the uniform says the shader reads it', () => {
  const buf = barMark.pass.pack(stacked) as ArrayBuffer
  const f32 = new Float32Array(buf)
  expect(f32[iface.INSTANCE_STRIDE_WORDS + 5]).toBe(4)
  const scratch = new ArrayBuffer(iface.UNIFORMS_SIZE_BYTES)
  const clip = clipBlock(block, frame.canvasWidth, frame.canvasHeight, {
    x: 1,
    y: 1,
  })!
  barMark.writeUniforms(scratch, clip, block, frame, params)
  expect(new Int32Array(scratch)[iface.UNIFORM_OFFSET_I32.y2Mode]).toBe(1)
  barMark.writeUniforms(scratch, clip, block, frame, {
    ...params,
    standsOnY2: false,
  })
  expect(new Int32Array(scratch)[iface.UNIFORM_OFFSET_I32.y2Mode]).toBe(0)
})

test('a caller with no y2 lane packs zeros and stands on the origin', () => {
  const plain: BarChannels = { ...stacked, y2: undefined }
  const buf = barMark.pass.pack(plain) as ArrayBuffer
  expect(new Float32Array(buf)[5]).toBe(0)
  const r = barMark.ink!(
    plain,
    block,
    frame,
    { ...params, standsOnY2: false },
    1,
  )!
  expect(r.top + r.height).toBe(120)
})

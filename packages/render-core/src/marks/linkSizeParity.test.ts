import { clipBlock } from '../blockClipUtils.ts'
import * as iface from '../shaders/linkMark.iface.generated.ts'
import { linkStrokeWidthPx } from '../shaders/linkMark.js.generated.ts'
import { recordingContext } from './drawAgainstHit.ts'
import { linkMark } from './linkMark.ts'

import type { LinkChannels, LinkParams, LinkRegion } from './linkMark.ts'

// A link's stroke width is decided twice: by the packed lane the shader reads,
// and by `placeLink` for the painter, the ink and the hit test. Both are driven
// here off the same channels, because either pinned alone agrees with whatever
// it currently does.

const regions: LinkRegion[] = [{ anchorPx: 0, anchorBp: 0, signedPxPerBp: 1 }]

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 2000, canvasHeight: 100 }

// A size domain straddling zero, over a range whose floor clears
// `linkStrokeWidthPx`'s 1.5 device px minimum, so a width read off the wrong
// end of the scale cannot hide under the floor.
const scaled: LinkParams = {
  domain: [0, 10],
  regions,
  linkShape: 'dome',
  valued: false,
  sizePx: 2,
  sizeScale: { domain: [-10, 10], scale: 'linear', range: [2, 12] },
}

function channels(sizes: number[] | undefined): LinkChannels {
  const count = sizes?.length ?? 1
  return {
    x: Uint32Array.from({ length: count }, (_, i) => 100 + i * 200),
    x2: Uint32Array.from({ length: count }, (_, i) => 200 + i * 200),
    x2Region: new Uint32Array(count),
    ...(sizes ? { size: Float32Array.from(sizes) } : {}),
    color: new Uint32Array(count).fill(0xff0000ff),
    count,
  }
}

function instance(c: LinkChannels, i: number): LinkChannels {
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    x2Region: c.x2Region.subarray(i, i + 1),
    ...(c.size ? { size: c.size.subarray(i, i + 1) } : {}),
    color: c.color!.subarray(i, i + 1),
    count: 1,
  }
}

function gpuStrokePx(c: LinkChannels, params: LinkParams, i: number) {
  const packed = new Float32Array(linkMark.pass.pack(c) as ArrayBuffer)
  const scratch = new ArrayBuffer(iface.UNIFORMS_SIZE_BYTES)
  linkMark.writeUniforms(
    scratch,
    clipBlock(block, frame.canvasWidth, frame.canvasHeight, { x: 1, y: 1 })!,
    block,
    frame,
    params,
  )
  const f32 = new Float32Array(scratch)
  const i32 = new Int32Array(scratch)
  const F = iface.UNIFORM_OFFSET_F32
  const I = iface.UNIFORM_OFFSET_I32
  return linkStrokeWidthPx(
    packed[i * iface.INSTANCE_STRIDE_WORDS + iface.INSTANCE_OFFSET_F32.size]!,
    i32[I.sizeMode]!,
    f32[F.sizeConstantPx]!,
    f32[F.sizeDomainMin]!,
    f32[F.sizeDomainMax]!,
    i32[I.sizeScaleType]!,
    f32[F.sizeRangeMin]!,
    f32[F.sizeRangeMax]!,
    f32[F.devicePixelRatio]!,
  )
}

function paintedStrokePx(c: LinkChannels, params: LinkParams, i: number) {
  const { ctx } = recordingContext()
  linkMark.paintBlock(ctx, instance(c, i), block, frame, params)
  return ctx.lineWidth
}

function widths(c: LinkChannels, params: LinkParams, i: number) {
  return {
    gpu: gpuStrokePx(c, params, i),
    painted: paintedStrokePx(c, params, i),
  }
}

test('a size scale with no size lane strokes the range floor on both backends', () => {
  const { gpu, painted } = widths(channels(undefined), scaled, 0)
  expect(gpu).toBe(painted)
  expect(painted).toBe(2)
})

test('a non-finite size strokes the range floor on both backends', () => {
  const c = channels([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, NaN])
  for (let i = 0; i < c.count; i++) {
    const { gpu, painted } = widths(c, scaled, i)
    expect(gpu).toBe(painted)
    expect(painted).toBe(2)
  }
})

test('a finite size strokes its place in the range on both backends', () => {
  const c = channels([-10, 0, 10])
  const want = [2, 7, 12]
  for (let i = 0; i < c.count; i++) {
    const { gpu, painted } = widths(c, scaled, i)
    expect(gpu).toBeCloseTo(painted, 5)
    expect(painted).toBeCloseTo(want[i]!, 5)
  }
})

test('no size scale strokes the constant on both backends, lane or no lane', () => {
  const constant: LinkParams = { ...scaled, sizeScale: undefined }
  for (const c of [channels(undefined), channels([7])]) {
    const { gpu, painted } = widths(c, constant, 0)
    expect(gpu).toBe(painted)
    expect(painted).toBe(2)
  }
})

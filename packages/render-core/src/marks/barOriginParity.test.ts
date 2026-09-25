import { clipBlock } from '../blockClipUtils.ts'
import * as iface from '../shaders/barMark.iface.generated.ts'
import { barMark } from './barMark.ts'

import type { BarChannels, BarParams } from './barMark.ts'

// The baseline a bar grows from is one value on the display's scale, shared by
// every instance in the draw, so the shader takes it resolved as `originYPx`
// rather than running the scale again at each of a bar's six vertices. That
// makes the uniform and the painter two readings of the same number, and only
// a test driving both can say they agree — the shader arrives at its baseline
// through a uniform the painter never reads.

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 1000,
  reversed: false,
}

const frame = { canvasWidth: 1000, canvasHeight: 120 }

const SYMLOG = { scaleType: 'symlog', symlogConstant: 0.05 } as const
const LOG = { scaleType: 'log' } as const

// One bar, on row 0 so the band top is `rowOffsetPx` alone, with a value the
// painter draws a real rect for.
function bar(y: number): BarChannels {
  return {
    x: Uint32Array.from([10]),
    x2: Uint32Array.from([40]),
    y: Float32Array.from([y]),
    color: Uint32Array.from([0xff0000ff]),
    row: Uint32Array.from([0]),
    count: 1,
  }
}

function uniformOriginYPx(params: BarParams) {
  const scratch = new ArrayBuffer(iface.UNIFORMS_SIZE_BYTES)
  barMark.writeUniforms(
    scratch,
    clipBlock(block, frame.canvasWidth, frame.canvasHeight, { x: 1, y: 1 })!,
    block,
    frame,
    params,
  )
  return new Float32Array(scratch)[iface.UNIFORM_OFFSET_F32.originYPx]!
}

// The painter's baseline, read off the rect it draws: a bar runs between its
// value and the baseline, so one of the rect's two horizontal edges IS the
// baseline. Which one is the probe's side of the origin, named per case
// because a clamped origin has only one side. Less the band's top, which is
// what the shader adds back per instance.
function paintedOriginYPx(params: BarParams, [y, side]: Probe) {
  const r = barMark.ink!(bar(y), block, frame, params, 0)!
  const edge = side === 'below' ? r.top + r.height : r.top
  return edge - (params.rowOffsetPx ?? 0)
}

// A probe value and where it sits against the origin on the value scale.
type Probe = [number, 'above' | 'below']

const base = { minWidthPx: 2, seamPx: 0 } as const

test.each<[string, BarParams, Probe]>([
  [
    'linear, zero origin',
    { ...base, domain: [-1, 1], origin: 0 },
    [0.5, 'below'],
  ],
  [
    'linear, a value under the origin',
    { ...base, domain: [-1, 1], origin: 0 },
    [-0.5, 'above'],
  ],
  [
    'linear, origin below the domain',
    { ...base, domain: [-1, 1], origin: -2 },
    [0.5, 'below'],
  ],
  [
    'linear, origin above the domain',
    { ...base, domain: [-1, 1], origin: 3 },
    [-0.5, 'above'],
  ],
  ['log', { ...base, domain: [1, 1024], origin: 32, ...LOG }, [256, 'below']],
  [
    'log, domain below 1',
    { ...base, domain: [0.01, 0.5], origin: 0.1, ...LOG },
    [0.3, 'below'],
  ],
  [
    'symlog',
    { ...base, domain: [-1, 1], origin: 0.3, ...SYMLOG },
    [0.8, 'below'],
  ],
  [
    'symlog, origin inside the linear region',
    { ...base, domain: [-1, 1], origin: 0.02, ...SYMLOG },
    [0.5, 'below'],
  ],
  [
    'a band inset inside a taller row',
    {
      ...base,
      domain: [0, 10],
      origin: 0,
      rowHeight: 40,
      rowBandPx: 24,
      rowOffsetPx: 8,
    },
    [6, 'below'],
  ],
  [
    'a scrolled band',
    {
      ...base,
      domain: [0, 10],
      origin: 2,
      rowHeight: 40,
      rowBandPx: 30,
      rowOffsetPx: -12,
    },
    [6, 'below'],
  ],
])('%s', (_label, params, probe) => {
  // Four places, not more: the uniform is the painter's number stored as a
  // float32, which costs an ulp — 2e-6 px at the band heights here, against an
  // antialiasing ramp one device pixel wide.
  expect(uniformOriginYPx(params)).toBeCloseTo(
    paintedOriginYPx(params, probe),
    4,
  )
})

// The band the origin is read over is the value scale's, not the row pitch.
// Writing the pitch into the uniform would put the baseline off the bottom of
// every inset band, which the case above catches only because the two numbers
// differ there.
test('the origin is read over the band, not the row pitch', () => {
  const inset: BarParams = {
    ...base,
    domain: [0, 10],
    origin: 0,
    rowHeight: 40,
    rowBandPx: 24,
  }
  expect(uniformOriginYPx(inset)).toBeCloseTo(24, 6)
  expect(uniformOriginYPx({ ...inset, rowBandPx: undefined })).toBeCloseTo(
    40,
    6,
  )
})

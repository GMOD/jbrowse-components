import { COLOR_RAMP_LUT_ENTRIES } from '../colorRampLut.ts'
import { MockHal } from '../hal/mockHal.ts'
import { GpuMarkBackend } from './markBackend.ts'
import { pointMark } from './pointMark.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { TextureBinding } from '../hal/types.ts'
import type { PointChannels, PointParams } from './pointMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { Mark, MarkBand, MarkContext2D, MarkShape } from './types.ts'

interface Region {
  span: SpanChannels
  point: PointChannels
}
interface State {
  canvasWidth: number
  canvasHeight: number
  span: SpanParams
  point: PointParams
  band: MarkBand
  ramp?: Uint8Array
}

Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 1,
  writable: true,
  configurable: true,
})

const REGION: Region = {
  span: {
    x: Uint32Array.of(10),
    x2: Uint32Array.of(20),
    row: Uint32Array.of(0),
    color: Uint32Array.of(0xff0000ff),
    count: 1,
  },
  point: {
    x: new Uint32Array(0),
    x2: new Uint32Array(0),
    y: new Float32Array(0),
    color: new Uint32Array(0),
    glyph: new Uint8Array(0),
    count: 0,
  },
}

const state = (height: number): State => ({
  canvasWidth: 100,
  canvasHeight: 80,
  span: {
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
  },
  point: { domain: [0, 1], diameterPx: 4 },
  band: { top: 30, height },
})

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

const span = defineMark({
  shape: spanMark,
  channels: (d: Region) => d.span,
  params: (s: State) => s.span,
})

test('a mark drawing off another buffer must share its instance struct', () => {
  expect(
    defineMark({
      shape: spanMark,
      channels: (d: Region) => d.span,
      params: (s: State) => s.span,
      bufferOf: span,
    }).bufferOf,
  ).toBe('span')
  expect(() =>
    defineMark({
      shape: pointMark,
      channels: (d: Region) => d.point,
      params: (s: State) => s.point,
      bufferOf: span,
    }),
  ).toThrow(/point draws off span's buffer/)
})

describe('a mark with a band', () => {
  const banded = defineMark({
    shape: spanMark,
    channels: (d: Region) => d.span,
    params: (s: State) => s.span,
    band: (s: State) => s.band,
  })

  function render(height: number) {
    const hal = new MockHal([banded.pass])
    const backend = new GpuMarkBackend(hal, [banded])
    backend.upload(0, REGION)
    backend.renderBlocks([block], new Map([[0, REGION]]), state(height))
    return hal
  }

  test('the GPU scissors the band and hands the block column back', () => {
    const hal = render(20)
    expect(hal.draws().map(d => d.scissor)).toEqual([
      { x: 0, y: 30, w: 100, h: 20 },
    ])
    expect(hal.callsOf('setScissor').at(-1)!.args).toEqual([0, 0, 100, 80])
  })

  test('a zero-height band draws nothing on either backend', () => {
    expect(render(0).draws()).toHaveLength(0)
    const { ctx, rects } = recordingCtx()
    banded.paintBlock(ctx, REGION, block, state(0))
    expect(rects).toHaveLength(0)
  })

  test('Canvas2D clips to the band before the shape paints', () => {
    const { ctx, rects, clips } = recordingCtx()
    banded.paintBlock(ctx, REGION, block, state(20))
    expect(clips).toEqual([[0, 30, 100, 20]])
    expect(rects).toHaveLength(1)
  })

  test('a hit outside the band is no hit', () => {
    const hit = (y: number) =>
      banded.hitNearest!(REGION, block, state(20), 15, y, [0], Infinity)
    expect(hit(35)).toBeDefined()
    expect(hit(60)).toBeUndefined()
  })
})

// The shape a display declaring several layers over one shader family has:
// distinct passes, one `writeUniforms` between them. `coverageBandMarks` is
// five of these and `featureGlyphMarks` another five.
const layerShape = (id: string): MarkShape<SpanChannels, SpanParams> => ({
  ...spanMark,
  id,
  pass: { ...spanMark.pass, id },
})

describe('marks sharing a uniform writer and a params lens', () => {
  Object.defineProperty(globalThis, 'devicePixelRatio', {
    value: 1,
    writable: true,
    configurable: true,
  })
  const REGION: Region = {
    span: {
      x: Uint32Array.of(10),
      x2: Uint32Array.of(20),
      row: Uint32Array.of(0),
      color: Uint32Array.of(0xff0000ff),
      count: 1,
    },
    point: {
      x: new Uint32Array(0),
      x2: new Uint32Array(0),
      y: new Float32Array(0),
      color: new Uint32Array(0),
      glyph: new Uint8Array(0),
      count: 0,
    },
  }
  const STATE: State = {
    canvasWidth: 100,
    canvasHeight: 80,
    span: {
      rowHeight: 10,
      rowProportion: 1,
      minWidthPx: 0,
      seamPx: 0,
      scrollTop: 0,
    },
    point: { domain: [0, 1], diameterPx: 4 },
    band: { top: 30, height: 20 },
  }
  const BLOCKS = [0, 1].map(i => ({
    displayedRegionIndex: i,
    start: i * 100,
    end: (i + 1) * 100,
    screenStartPx: i * 50,
    screenEndPx: (i + 1) * 50,
    reversed: false,
  }))

  function render(marks: Mark<Region, State>[], blocks = BLOCKS.slice(0, 1)) {
    const hal = new MockHal(marks.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, marks)
    for (const block of blocks) {
      backend.upload(block.displayedRegionIndex, REGION)
    }
    backend.renderBlocks(
      blocks,
      new Map(blocks.map(b => [b.displayedRegionIndex, REGION])),
      STATE,
    )
    return hal
  }

  const channels = (d: Region) => d.span
  const shared = (s: State) => s.span

  test('N marks stage one uniform write and every draw reads it', () => {
    const hal = render(
      ['a', 'b', 'c'].map(id =>
        defineMark({ shape: layerShape(id), channels, params: shared }),
      ),
    )
    expect(hal.getUniformWritesF32()).toHaveLength(1)
    expect(hal.draws().map(d => `${d.passId}:${d.uniformWrite}`)).toEqual([
      'a:0',
      'b:0',
      'c:0',
    ])
  })

  test('a per-mark params lens is a per-mark write', () => {
    const hal = render(
      ['a', 'b', 'c'].map(id =>
        defineMark({
          shape: layerShape(id),
          channels,
          // same VALUES, three references: the reuse is by reference on
          // purpose, so nothing has to reason about what a lens might read
          params: (s: State) => s.span,
        }),
      ),
    )
    expect(hal.getUniformWritesF32()).toHaveLength(3)
    expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 1, 2])
  })

  test('the reuse resets per block, so each block draws its own clip', () => {
    const hal = render(
      ['a', 'b', 'c'].map(id =>
        defineMark({ shape: layerShape(id), channels, params: shared }),
      ),
      BLOCKS,
    )
    const writes = hal.getUniformWritesF32()
    expect(writes).toHaveLength(2)
    // bpRangeX's hi/lo start: block 1 begins at bp 100, block 0 at bp 0
    expect([writes[0]![1], writes[1]![1]]).toEqual([0, 100])
    expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 0, 0, 1, 1, 1])
  })

  test('a banded mark reusing a write still scissors to its band', () => {
    const plain = defineMark({
      shape: layerShape('a'),
      channels,
      params: shared,
    })
    const banded = defineMark({
      shape: layerShape('b'),
      channels,
      params: shared,
      band: (s: State) => s.band,
    })
    const hal = render([plain, banded])
    expect(hal.getUniformWritesF32()).toHaveLength(1)
    expect(hal.draws().map(d => d.scissor)).toEqual([
      { x: 0, y: 0, w: 50, h: 80 },
      { x: 0, y: 30, w: 50, h: 20 },
    ])
    expect(hal.draws().map(d => d.uniformWrite)).toEqual([0, 0])
  })
})

// The ramp binding a shader with a `Sampler2D` reflects; the values are
// arbitrary here, since what MockHal answers from is only that the pass
// declares one.
const RAMP_BINDING: TextureBinding = {
  textureBinding: 2,
  samplerBinding: 3,
  glTextureUnit: 0,
  glUniformName: 'u_colorRamp',
  filter: 'linear',
}

describe('a mark with a ramp texture', () => {
  const rampA = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4).fill(1)
  const rampB = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4).fill(2)
  const textured = defineMark({
    shape: {
      ...spanMark,
      pass: { ...spanMark.pass, textures: [RAMP_BINDING] },
    },
    channels: (d: Region) => d.span,
    params: (s: State) => s.span,
    texture: (s: State) => s.ramp,
  })

  function frames(...ramps: (Uint8Array | undefined)[]) {
    const hal = new MockHal([textured.pass])
    const backend = new GpuMarkBackend(hal, [textured])
    backend.upload(0, REGION)
    for (const ramp of ramps) {
      backend.renderBlocks([block], new Map([[0, REGION]]), {
        ...state(20),
        ramp,
      })
    }
    return hal
  }

  test('the ramp uploads on the first draw and an unchanged one never again', () => {
    const hal = frames(rampA, rampA, rampA)
    expect(hal.callsOf('uploadTexture')).toHaveLength(1)
    expect(hal.getTexture('span')).toEqual(rampA)
  })

  test('a changed ramp is exactly one more upload', () => {
    const hal = frames(rampA, rampB, rampB)
    expect(hal.callsOf('uploadTexture')).toHaveLength(2)
    expect(hal.getTexture('span')).toEqual(rampB)
  })

  // A textured pass with no texture never draws on the WebGPU HAL, so the mark
  // that names none still binds a table — the inert one, once.
  test('no ramp binds an inert table, once', () => {
    const hal = frames(undefined, undefined)
    expect(hal.callsOf('uploadTexture')).toHaveLength(1)
    expect(hal.getTexture('span')).toEqual(
      new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4),
    )
    expect(hal.draws()).toHaveLength(2)
  })
})

function recordingCtx() {
  const rects: number[][] = []
  const clips: number[][] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(...args: number[]) {
      rects.push(args)
    },
    rect(...args: number[]) {
      clips.push(args)
    },
    save() {},
    restore() {},
    beginPath() {},
    clip() {},
    translate() {},
    moveTo() {},
    lineTo() {},
    bezierCurveTo() {},
    arc() {},
    ellipse() {},
    setLineDash() {},
    closePath() {},
    fill() {},
    stroke() {},
    strokeRect() {},
    scale() {},
    rotate() {},
  } satisfies MarkContext2D
  return { ctx, rects, clips }
}

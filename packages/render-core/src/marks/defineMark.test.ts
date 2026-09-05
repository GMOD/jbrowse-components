import { MockHal } from '../hal/mockHal.ts'
import { GpuMarkBackend } from './markBackend.ts'
import { pointMark } from './pointMark.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { PointChannels, PointParams } from './pointMark.ts'
import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkBand, MarkContext2D } from './types.ts'

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
    arc() {},
    closePath() {},
    fill() {},
    stroke() {},
    strokeRect() {},
  } satisfies MarkContext2D
  return { ctx, rects, clips }
}

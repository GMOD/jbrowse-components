import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  canvasWideBlock,
  canvasWideBlocks,
} from '@jbrowse/render-core/renderBlock'

import { chordLayerMarks, chordMark, ribbonMark } from './chordMarks.ts'
import { canvasPathSink, svgPathSink } from './pathSink.ts'
import { traceRibbon } from './ribbonGeometry.ts'
import * as ribbonShader from './shaders/ribbon.generated.ts'

import type {
  ChordCell,
  ChordLayerFrame,
  ChordStageParams,
} from './chordMarks.ts'
import type { ChordLanes, RibbonLanes } from './chordStage.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

const OPAQUE_RED = 0xff0000ff
const OPAQUE_BLUE = 0xffff0000
const DIM_RED = 0x260000ff

function ribbonLanes(
  rows: [number, number, number, number, number, number][],
): RibbonLanes {
  const n = rows.length
  const lanes: RibbonLanes = {
    x1: new Float32Array(rows.map(r => r[0])),
    x2: new Float32Array(rows.map(r => r[1])),
    y1: new Float32Array(rows.map(r => r[2])),
    y2: new Float32Array(rows.map(r => r[3])),
    xSlice: new Uint32Array(n),
    ySlice: new Uint32Array(n),
    strand: new Float32Array(rows.map(r => r[4])),
    color: new Uint32Array(rows.map(r => r[5])),
    count: n,
    features: [],
  }
  return lanes
}

function chordLanes(rows: [number, number, number][]): ChordLanes {
  return {
    x: new Float32Array(rows.map(r => r[0])),
    x2: new Float32Array(rows.map(r => r[1])),
    xSlice: new Uint32Array(rows.length),
    x2Slice: new Uint32Array(rows.length),
    color: new Uint32Array(rows.map(r => r[2])),
    count: rows.length,
    features: [],
  }
}

// a thousand bases to the radian on a 200 px circle
const params: ChordStageParams = {
  centerX: 250,
  centerY: 250,
  radiansPerBp: 0.001,
  gapRadians: 0,
  offsetRadians: 0,
  radiusPx: 200,
  bezierRadiusPx: 20,
  alpha: 0.25,
  strokeWidthPx: 1,
}

const frame: ChordLayerFrame = {
  canvasWidth: 500,
  canvasHeight: 500,
  centerX: 250,
  centerY: 250,
  radiansPerBp: 0.001,
  gapRadians: 0,
  offsetRadians: 0.3,
  radiusPx: 200,
}

function recordingContext() {
  const calls: string[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy({} as MarkContext2D, {
    get: (_t, key: string) =>
      key in state
        ? state[key]
        : (...args: unknown[]) => {
            calls.push(
              `${key}(${args.map(a => (typeof a === 'number' ? a.toFixed(2) : String(a))).join(',')})`,
            )
            if (key === 'fill' || key === 'stroke') {
              calls.push(
                `  paint=${String(state.fillStyle ?? state.strokeStyle)}`,
              )
            }
          },
    set: (_t, key: string, value) => {
      state[key] = value
      if (key === 'strokeStyle') {
        state.fillStyle = undefined
      }
      return true
    },
  })
  return { ctx, calls }
}

// the svg arc's sweep and large-arc flags and the canvas arc's direction, read
// off the same trace, so a flipped direction on either side fails here
describe('one trace, two sinks', () => {
  test.each([
    ['forward, short arcs', { a1: 0.1, a2: 0.4, m1: 3.4, m2: 3.1 }],
    ['reverse strand', { a1: 0.1, a2: 0.4, m1: 3.1, m2: 3.4 }],
    ['an arc longer than π', { a1: 0.5, a2: 4.5, m1: 5.2, m2: 5 }],
  ])('%s: the svg flags and the canvas direction agree', (_name, angles) => {
    const svg = svgPathSink()
    traceRibbon(svg, angles, 200, 20)
    const { ctx, calls } = recordingContext()
    traceRibbon(canvasPathSink(ctx), angles, 200, 20)
    const flags = [
      ...svg.toString().matchAll(/A [\d.]+ [\d.]+ 0 (\d) (\d)/g),
    ].map(m => ({ largeArc: m[1] === '1', sweep: m[2] === '1' }))
    const arcs = calls
      .filter(c => c.startsWith('arc('))
      .map(c => {
        const [, , , from, to, ccw] = c.slice(4, -1).split(',')
        return { from: Number(from), to: Number(to), ccw: ccw === 'true' }
      })
    expect(arcs).toHaveLength(2)
    for (const [i, arc] of arcs.entries()) {
      // a sweep of 1 is an increasing angle, which the canvas draws clockwise
      expect(arc.ccw).toBe(arc.to < arc.from)
      expect(flags[i]!.sweep).toBe(arc.to > arc.from)
      expect(flags[i]!.largeArc).toBe(Math.abs(arc.to - arc.from) > Math.PI)
    }
    expect(calls.map(c => c.split('(')[0])).toEqual([
      'moveTo',
      'arc',
      'bezierCurveTo',
      'arc',
      'bezierCurveTo',
      'closePath',
    ])
  })

  // the canvas takes the curve as a cubic, which is the quadratic exactly
  test("the canvas's cubic passes through the svg quadratic's midpoint", () => {
    const svg = svgPathSink()
    svg.moveTo(200, 0)
    svg.quadTo(10, 20, 200, 2)
    const [, x0, y0, cx, cy, x1, y1] = svg
      .toString()
      .split(/[ MQ]+/)
      .map(Number)
    const quadMid = [
      0.25 * x0! + 0.5 * cx! + 0.25 * x1!,
      0.25 * y0! + 0.5 * cy! + 0.25 * y1!,
    ]
    let cubic: number[] = []
    const ctx = {
      moveTo() {},
      bezierCurveTo(...args: number[]) {
        cubic = args
      },
    } as unknown as MarkContext2D
    const sink = canvasPathSink(ctx)
    sink.moveTo(200, 0)
    sink.quadTo(10, 20, 200, 2)
    const [c1x, c1y, c2x, c2y, ex, ey] = cubic
    const cubicMid = [
      0.125 * x0! + 0.375 * c1x! + 0.375 * c2x! + 0.125 * ex!,
      0.125 * y0! + 0.375 * c1y! + 0.375 * c2y! + 0.125 * ey!,
    ]
    expect(cubicMid[0]).toBeCloseTo(quadMid[0]!, 9)
    expect(cubicMid[1]).toBeCloseTo(quadMid[1]!, 9)
  })
})

describe('the canvas2d rung', () => {
  test("fills each ribbon at its colour's alpha times the display's", () => {
    const { ctx, calls } = recordingContext()
    ribbonMark.paintBlock(
      ctx,
      ribbonLanes([
        [0, 500, 3000, 2500, 1, DIM_RED],
        [500, 1000, 3500, 3000, 1, OPAQUE_BLUE],
      ]),
      canvasWideBlock(0, 500),
      frame,
      params,
    )
    expect(calls.filter(c => c.startsWith('  paint='))).toEqual([
      `  paint=rgba(255,0,0,${(0x26 / 255) * 0.25})`,
      '  paint=rgba(0,0,255,0.25)',
    ])
  })

  test('strokes a chord in its own colour and skips one under a pixel', () => {
    const { ctx, calls } = recordingContext()
    chordMark.paintBlock(
      ctx,
      chordLanes([
        [0, 3000, OPAQUE_RED],
        [1000, 1001, OPAQUE_BLUE],
      ]),
      canvasWideBlock(0, 500),
      frame,
      { ...params, alpha: 1 },
    )
    expect(calls.filter(c => c.startsWith('stroke('))).toHaveLength(1)
    expect(calls.filter(c => c.startsWith('fill('))).toHaveLength(0)
    expect(calls.find(c => c.startsWith('  paint='))).toBe(
      '  paint=rgba(255,0,0,1)',
    )
  })
})

describe('the gpu rung', () => {
  const cellDisplay = { shapeAlpha: 0.4, bezierRadiusRatio: 0.1 }
  const cells = new Map<number, ChordCell>([
    [
      0,
      {
        kind: 'ribbon',
        lanes: ribbonLanes([[0, 500, 3000, 2500, -1, OPAQUE_RED]]),
        display: cellDisplay,
      },
    ],
    [
      1,
      {
        kind: 'chord',
        lanes: chordLanes([[0, 3000, OPAQUE_BLUE]]),
        display: { shapeAlpha: 1, bezierRadiusRatio: 0.2 },
      },
    ],
  ])

  function render(f: ChordLayerFrame) {
    const hal = new MockHal(chordLayerMarks.map(m => m.pass))
    const backend = new GpuMarkBackend(hal, chordLayerMarks)
    for (const [key, cell] of cells) {
      backend.upload(key, cell)
    }
    backend.renderBlocks(
      canvasWideBlocks(cells.keys(), f.canvasWidth),
      cells,
      f,
    )
    return hal
  }

  test("draws each display's cell through its own pass, in track order", () => {
    const hal = render(frame)
    expect(hal.draws().map(d => [d.passId, d.regionKey])).toEqual([
      ['circularRibbon', 0],
      ['circularChord', 1],
    ])
  })

  test('uploads the lanes in the shader’s instance layout', () => {
    const hal = render(frame)
    const f32 = new Float32Array(hal.getBuffer(0, 'circularRibbon')!.data)
    const u32 = new Uint32Array(hal.getBuffer(0, 'circularRibbon')!.data)
    const F = ribbonShader.INSTANCE_OFFSET_F32
    expect([f32[F.x1], f32[F.x2], f32[F.y1], f32[F.y2], f32[F.strand]]).toEqual(
      [0, 500, 3000, 2500, -1],
    )
    expect(u32[ribbonShader.INSTANCE_OFFSET_U32.color]).toBe(OPAQUE_RED)
  })

  // the stage is uniforms: the rotation, the scale and each display's alpha
  // and bow reach the draw with no buffer rewritten
  test('writes the stage and each display’s own params as uniforms', () => {
    const hal = render(frame)
    const U = ribbonShader.UNIFORM_OFFSET_F32
    const [ribbon, chord] = hal.draws().map(d => hal.uniformsOf(d)!)
    expect(ribbon![U.offsetRadians]).toBeCloseTo(0.3)
    expect(ribbon![U.radiansPerBp]).toBeCloseTo(0.001)
    expect(ribbon![U.alpha]).toBeCloseTo(0.4)
    expect(ribbon![U.bezierRadiusPx]).toBeCloseTo(20)
    expect(chord![U.bezierRadiusPx]).toBeCloseTo(40)
  })
})

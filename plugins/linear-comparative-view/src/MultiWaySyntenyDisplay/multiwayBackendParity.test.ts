import { featureGlyphShader } from '@jbrowse/plugin-canvas'
import { MockHal } from '@jbrowse/render-core/hal'

import { UNIFORM_OFFSET_F32 as SYNTENY_U } from '../LinearSyntenyDisplay/shaders/syntenyFillStraight.generated.ts'
import { KIND_BASE } from '../LinearSyntenyRPC/syntenyColors.ts'
import { RibbonPickCells, drawMultiWay } from './Canvas2DMultiWayRenderer.ts'
import { GpuMultiWayRenderer, MULTIWAY_PASSES } from './GpuMultiWayRenderer.ts'
import { PX_ORIGIN } from './multiwayRenderTypes.ts'

import type { PickCanvasLike } from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type {
  LaneGlyphData,
  MultiWayCell,
  MultiWayRenderState,
} from './multiwayRenderTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const WIDTH = 800
const HEIGHT = 240
const DRAG = 37

// one ribbon, 100..200 over 300..400, in the gutter y 30..110
const ribbon: SyntenyInstanceData = {
  bp1: Float32Array.of(100),
  bp2: Float32Array.of(200),
  bp3: Float32Array.of(400),
  bp4: Float32Array.of(300),
  base0: 0,
  base1: 0,
  kinds: Uint8Array.of(KIND_BASE),
  instanceFeatureIdx: Uint32Array.of(7),
  alignmentLengths: Float32Array.of(100),
  instanceCount: 1,
  colors: Uint32Array.of(0xff808080),
}

// One lane's glyph cell: a CDS box at px 500..560 with its top at y 120, plus
// the intron line and arrowhead that ride the box's CENTRE at y 129. The two
// y families differ by design — see `centeredRowVisible` in the feature track's
// Canvas2D renderer — so a fixture carrying only rects cannot see a backend
// reading one of them the other way.
const GLYPH_TOP = 120
const GLYPH_H = 18
const GLYPH_CENTRE = GLYPH_TOP + GLYPH_H / 2
const glyphs: LaneGlyphData = {
  rectPositions: Uint32Array.of(PX_ORIGIN + 500, PX_ORIGIN + 560),
  rectYs: Float32Array.of(GLYPH_TOP),
  rectHeights: Float32Array.of(GLYPH_H),
  rectColors: Uint32Array.of(0xff2020da),
  rectStrands: Float32Array.of(0),
  rectDensityFade: Uint32Array.of(0),
  linePositions: Uint32Array.of(PX_ORIGIN + 400, PX_ORIGIN + 500),
  lineYs: Float32Array.of(GLYPH_CENTRE),
  lineHeights: Float32Array.of(GLYPH_H),
  lineColors: Uint32Array.of(0xff333333),
  lineDirections: Int8Array.of(1),
  arrowXs: Uint32Array.of(PX_ORIGIN + 560),
  arrowYs: Float32Array.of(GLYPH_CENTRE),
  arrowHeights: Float32Array.of(GLYPH_H),
  arrowWidthsBp: Uint32Array.of(160),
  arrowDirections: Int8Array.of(1),
  arrowColors: Uint32Array.of(0xff333333),
  outlineColor: 0,
  hits: [],
}

const cells = new Map<string, MultiWayCell>([
  ['ribbons:0', { kind: 'ribbons', data: ribbon }],
  ['glyphs:1', { kind: 'glyphs', data: glyphs }],
])

const state: MultiWayRenderState = {
  width: WIDTH,
  height: HEIGHT,
  dragOffsetPx: DRAG,
  scrollTopPx: 0,
  hoveredFeatureId: 0,
  clickedFeatureId: 0,
  groundColor: '#fff',
  layers: [
    { kind: 'ribbons', key: 'ribbons:0', yTop: 30, height: 80, curves: false },
    { kind: 'glyphs', key: 'glyphs:1', scrolled: true },
  ],
}

interface Call {
  method: string
  args: number[]
}

// a 2D context that records every call and accepts every style assignment
function recordingCtx() {
  const calls: Call[] = []
  const ctx = new Proxy(
    {},
    {
      get: (_target, prop: string) =>
        prop === 'calls'
          ? calls
          : (...args: unknown[]) => {
              calls.push({ method: prop, args: args as number[] })
            },
      set: () => true,
    },
  ) as Ctx2D & { calls: Call[] }
  return ctx
}

function gpuFrame(renderState = state) {
  const hal = new MockHal(MULTIWAY_PASSES)
  const canvas = document.createElement('canvas')
  const renderer = new GpuMultiWayRenderer(hal, canvas)
  for (const [key, cell] of cells) {
    renderer.upload(key, cell)
  }
  renderer.render(renderState)
  return { hal, renderer }
}

test('a glyph lands at the same px on both backends: the drag rides the layer transform alone', () => {
  const ctx = recordingCtx()
  drawMultiWay(ctx, cells, state)
  const fill = ctx.calls.find(c => c.method === 'fillRect')!
  expect(fill.args[0]).toBe(500 + DRAG)
  expect(fill.args[1]).toBe(120)

  // the intron line and the arrowhead ride the box's centre, and Canvas2D
  // snaps that to a crisp half-pixel — so they land a half glyph BELOW the
  // rect's top rather than on it
  const stroke = ctx.calls.find(
    c => c.method === 'moveTo' && Math.abs(c.args[1]! - GLYPH_CENTRE) <= 1,
  )!
  expect(stroke.args[0]).toBe(400 + DRAG)
  expect(stroke.args[1]).toBeGreaterThan(fill.args[1]!)

  const { hal } = gpuFrame()
  const rectDraw = hal.draws().find(d => d.passId === 'rect')!
  const u = hal.uniformsOf(rectDraw)!
  // bpRangeX is the hp split of the layer's range start, so the px the shader
  // puts a position at is (position − hi − lo): the Canvas2D `toX`
  const rangeStart = u[0]! + u[1]!
  expect(PX_ORIGIN + 500 - rangeStart).toBe(500 + DRAG)
  expect(u[2]).toBe(WIDTH)
  // both y families reach the GPU as the cell states them; the passes are the
  // feature track's own and each reads its own convention
  const lineDraw = hal.draws().find(d => d.passId === 'line')!
  expect(hal.uniformsOf(lineDraw)![0]! + hal.uniformsOf(lineDraw)![1]!).toBe(
    rangeStart,
  )
})

test('a ribbon projects through the same pan on both backends', () => {
  const ctx = recordingCtx()
  drawMultiWay(ctx, cells, state)
  const move = ctx.calls.find(c => c.method === 'moveTo')!
  expect(move.args[0]).toBe(100 + DRAG)
  expect(move.args[1]).toBe(30)

  const { hal } = gpuFrame()
  const fill = hal.draws().find(d => d.passId === 'fillStraight')!
  const u = hal.uniformsOf(fill)!
  expect(u[SYNTENY_U.panPx0]).toBe(DRAG)
  expect(u[SYNTENY_U.bpPerPxInv0]).toBe(1)
  expect(u[SYNTENY_U.yTop]).toBe(30)
  expect(u[SYNTENY_U.height]).toBe(80)
})

test('the GPU frame draws the layers in the order the state lists them, ribbons under glyphs', () => {
  const { hal } = gpuFrame()
  expect(hal.draws().map(d => d.passId)).toEqual([
    'fillStraight',
    'line',
    'chevron',
    'rect',
    'arrow',
  ])
  expect(hal.draws().find(d => d.passId === 'chevron')!.bufferPassId).toBe(
    'line',
  )
})

test('a drawCurves toggle re-uploads the ribbon cell to the other fill pass', () => {
  const { hal, renderer } = gpuFrame()
  renderer.render({
    ...state,
    layers: [{ ...state.layers[0]!, curves: true } as never, state.layers[1]!],
  })
  const uploads = hal
    .callsOf('uploadBuffer')
    .map(c => c.args[1])
    .filter(p => p === 'fillStraight' || p === 'fillCurve')
  expect(uploads).toEqual(['fillStraight', 'fillCurve'])
})

function polygonPickCtx(): PickCanvasLike {
  let pts: [number, number][] = []
  const inside = (x: number, y: number) => {
    let hit = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!
      const [xj, yj] = pts[j]!
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        hit = !hit
      }
    }
    return hit
  }
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {
      pts = []
    },
    closePath() {},
    moveTo(x: number, y: number) {
      pts.push([x, y])
    },
    lineTo(x: number, y: number) {
      pts.push([x, y])
    },
    bezierCurveTo(
      _a: number,
      _b: number,
      _c: number,
      _d: number,
      x: number,
      y: number,
    ) {
      pts.push([x, y])
    },
    fill() {},
    stroke() {},
    isPointInPath: inside,
  }
}

// The lane-stack scroll is the vertical twin of the drag: one number in the
// render state, subtracted by every layer on both backends — the ribbon
// through its yTop, the glyphs through the passes' own scrollY — and by the
// pick, which reads its y bounds off the same shifted params.
describe('a scrolled stack shifts every layer by the same offset', () => {
  const SCROLL = 50
  const scrolled = { ...state, scrollTopPx: SCROLL }

  test('on Canvas2D', () => {
    const ctx = recordingCtx()
    drawMultiWay(ctx, cells, scrolled)
    const fill = ctx.calls.find(c => c.method === 'fillRect')!
    expect(fill.args[0]).toBe(500 + DRAG)
    expect(fill.args[1]).toBe(GLYPH_TOP - SCROLL)
    const move = ctx.calls.find(c => c.method === 'moveTo')!
    expect(move.args[1]).toBe(30 - SCROLL)
  })

  test('on the GPU', () => {
    const { hal } = gpuFrame(scrolled)
    const rectDraw = hal.draws().find(d => d.passId === 'rect')!
    expect(
      hal.uniformsOf(rectDraw)![featureGlyphShader.UNIFORM_OFFSET_F32.scrollY],
    ).toBe(SCROLL)
    const fill = hal.draws().find(d => d.passId === 'fillStraight')!
    expect(hal.uniformsOf(fill)![SYNTENY_U.yTop]).toBe(30 - SCROLL)
  })

  test('and the pick answers at the shifted y', () => {
    const cells = new RibbonPickCells(polygonPickCtx)
    cells.set('ribbons:0', ribbon)
    expect(cells.pick(250 + DRAG, 70 - SCROLL, scrolled, WIDTH)).toEqual({
      key: 'ribbons:0',
      instanceIndex: 0,
      targetIdx: 7,
    })
    expect(cells.pick(250 + DRAG, 70, scrolled, WIDTH)).toBeUndefined()
  })
})

test('a pick over the drawn ribbon answers its target through the same transform', () => {
  const cells = new RibbonPickCells(polygonPickCtx)
  cells.set('ribbons:0', ribbon)
  const pick = (x: number, y: number) => cells.pick(x, y, state, WIDTH)
  // at mid-height the ribbon spans 200..300 before the drag carries it right
  expect(pick(250 + DRAG, 70)).toEqual({
    key: 'ribbons:0',
    instanceIndex: 0,
    targetIdx: 7,
  })
  expect(pick(150, 70)).toBeUndefined()
  expect(pick(250 + DRAG, 20)).toBeUndefined()
})

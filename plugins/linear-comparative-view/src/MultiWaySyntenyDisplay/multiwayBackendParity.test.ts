import { MockHal } from '@jbrowse/render-core/hal'

import { UNIFORM_OFFSET_F32 as SYNTENY_U } from '../LinearSyntenyDisplay/shaders/syntenyFillStraight.generated.ts'
import { pickFeatureAtPoint } from '../LinearSyntenyDisplay/syntenyPickEngine.ts'
import { KIND_BASE } from '../LinearSyntenyRPC/syntenyColors.ts'
import {
  CellIds,
  drawMultiWay,
  ribbonPickResult,
  ribbonPickState,
} from './Canvas2DMultiWayRenderer.ts'
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

// one CDS box at px 500..560, y 120, in a scrolled lane
const glyphs: LaneGlyphData = {
  rectPositions: Uint32Array.of(PX_ORIGIN + 500, PX_ORIGIN + 560),
  rectYs: Float32Array.of(120),
  rectHeights: Float32Array.of(18),
  rectColors: Uint32Array.of(0xff2020da),
  rectStrands: Float32Array.of(0),
  rectDensityFade: Uint32Array.of(0),
  linePositions: new Uint32Array(0),
  lineYs: new Float32Array(0),
  lineHeights: new Float32Array(0),
  lineColors: new Uint32Array(0),
  lineDirections: new Int8Array(0),
  arrowXs: new Uint32Array(0),
  arrowYs: new Float32Array(0),
  arrowHeights: new Float32Array(0),
  arrowWidthsBp: new Uint32Array(0),
  arrowDirections: new Int8Array(0),
  arrowColors: new Uint32Array(0),
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
  hoveredFeatureId: 0,
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

function gpuFrame() {
  const hal = new MockHal(MULTIWAY_PASSES)
  const canvas = document.createElement('canvas')
  const renderer = new GpuMultiWayRenderer(hal, canvas)
  for (const [key, cell] of cells) {
    renderer.upload(key, cell)
  }
  renderer.render(state)
  return { hal, renderer }
}

test('a glyph lands at the same px on both backends: the drag rides the layer transform alone', () => {
  const ctx = recordingCtx()
  drawMultiWay(ctx, cells, state)
  const fill = ctx.calls.find(c => c.method === 'fillRect')!
  expect(fill.args[0]).toBe(500 + DRAG)
  expect(fill.args[1]).toBe(120)

  const { hal } = gpuFrame()
  const rectDraw = hal.draws().find(d => d.passId === 'rect')!
  const u = hal.uniformsOf(rectDraw)!
  // bpRangeX is the hp split of the layer's range start, so the px the shader
  // puts a position at is (position − hi − lo): the Canvas2D `toX`
  const rangeStart = u[0]! + u[1]!
  expect(PX_ORIGIN + 500 - rangeStart).toBe(500 + DRAG)
  expect(u[2]).toBe(WIDTH)
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

test('a pick over the drawn ribbon answers its target through the same transform', () => {
  const ids = new CellIds()
  const regions = new Map([[ids.of('ribbons:0'), ribbon]])
  const pick = (x: number, y: number) =>
    ribbonPickResult(
      pickFeatureAtPoint({
        ctx: polygonPickCtx(),
        state: ribbonPickState(state, key => ids.of(key)),
        regions,
        pickIndices: new Map(),
        canvasLogicalWidth: WIDTH,
        x,
        y,
      }),
      ids,
      regions,
    )
  // at mid-height the ribbon spans 200..300 before the drag carries it right
  expect(pick(250 + DRAG, 70)).toEqual({
    key: 'ribbons:0',
    instanceIndex: 0,
    targetIdx: 7,
  })
  expect(pick(150, 70)).toBeUndefined()
  expect(pick(250 + DRAG, 20)).toBeUndefined()
})

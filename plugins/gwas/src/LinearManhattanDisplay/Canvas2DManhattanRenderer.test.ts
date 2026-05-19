import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'

import type {
  ManhattanBackend,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

// Minimal Canvas2D mock recording the fillStyle/arc calls so we can assert
// per-feature colors are switched correctly.
type Call =
  | { kind: 'fillStyle'; value: string }
  | { kind: 'arc'; x: number; y: number }

function mockCtx() {
  const calls: Call[] = []
  let fillStyleStore = ''
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    moveTo() {},
    arc(x: number, y: number) {
      calls.push({ kind: 'arc', x, y })
    },
    fill() {},
    get fillStyle() {
      return fillStyleStore
    },
    set fillStyle(v: string) {
      fillStyleStore = v
      calls.push({ kind: 'fillStyle', value: v })
    },
  }
  return { ctx, calls }
}

const block: WiggleRenderBlock = {
  displayedRegionIndex: 0,
  bpRangeX: [0, 1000],
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

const state: ManhattanRenderState = {
  domainY: [0, 10],
  canvasWidth: 100,
  canvasHeight: 100,
}

// ABGR packing matches normalizedRgbToABGR/cssColorToABGR: 0xAABBGGRR.
function abgr(r: number, g: number, b: number, a = 255) {
  return (
    (((a & 0xff) << 24) |
      ((b & 0xff) << 16) |
      ((g & 0xff) << 8) |
      (r & 0xff)) >>>
    0
  )
}

function data(
  positions: number[],
  scores: number[],
  colors: number[],
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(positions),
    scores: new Float32Array(scores),
    colors: new Uint32Array(colors),
    numFeatures: positions.length,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    scoreSum: 0,
    scoreSumSq: 0,
  }
}

test('draws one arc per feature at the expected screen position', () => {
  const { ctx, calls } = mockCtx()
  const red = abgr(255, 0, 0)
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map([[0, data([0, 500, 1000], [10, 5, 0], [red, red, red])]]),
    [block],
    state,
  )
  const arcs = calls.filter(
    (c): c is Extract<Call, { kind: 'arc' }> => c.kind === 'arc',
  )
  expect(arcs).toHaveLength(3)
  // bp=0 → x=0, score=10 (max) → y=0
  expect(arcs[0]).toMatchObject({ x: 0, y: 0 })
  // bp=500 → x=50, score=5 → y=50
  expect(arcs[1]).toMatchObject({ x: 50, y: 50 })
  // bp=1000 → x=100, score=0 → y=100
  expect(arcs[2]).toMatchObject({ x: 100, y: 100 })
})

test('switches fillStyle per unique per-feature color', () => {
  const { ctx, calls } = mockCtx()
  const red = abgr(255, 0, 0)
  const blue = abgr(0, 0, 255)
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map([[0, data([100, 200, 300], [5, 5, 5], [red, blue, blue])]]),
    [block],
    state,
  )
  const fills = calls
    .filter(
      (c): c is Extract<Call, { kind: 'fillStyle' }> => c.kind === 'fillStyle',
    )
    .map(c => c.value)
  // Initial red → switch to blue once (covers both blue points).
  expect(fills).toEqual(['rgb(255,0,0)', 'rgb(0,0,255)'])
})

test('skips regions with no data', () => {
  const { ctx, calls } = mockCtx()
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map(),
    [block],
    state,
  )
  expect(calls.filter(c => c.kind === 'arc')).toHaveLength(0)
})

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Minimal Canvas2D mock recording the fillStyle/arc calls so we can assert
// per-feature colors are switched correctly.
type Call =
  | { kind: 'fillStyle'; value: string }
  | { kind: 'arc'; x: number; y: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'lineTo'; x: number; y: number }

function mockCtx() {
  const calls: Call[] = []
  let fillStyleStore = ''
  let clipped = false
  const ctx = {
    save() {},
    restore() {},
    beginPath() {},
    rect(x: number, y: number, w: number, h: number) {
      // The first rect() call is the clip region (before clip()); only record
      // feature bars drawn after the clip is established.
      if (clipped) {
        calls.push({ kind: 'rect', x, y, w, h })
      }
    },
    clip() {
      clipped = true
    },
    moveTo() {},
    closePath() {},
    lineTo(x: number, y: number) {
      calls.push({ kind: 'lineTo', x, y })
    },
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

const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 0,
  end: 1000,
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
  ends: number[] = positions.map(p => p + 1),
  glyphs: number[] = positions.map(() => 0),
): ManhattanRpcResult {
  return {
    positions: new Uint32Array(positions),
    ends: new Uint32Array(ends),
    glyphs: new Uint8Array(glyphs),
    scores: new Float32Array(scores),
    colors: new Uint32Array(colors),
    numFeatures: positions.length,
    scoreMin: Math.min(...scores),
    scoreMax: Math.max(...scores),
    flatbushData: undefined,
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

test('draws a ranged SV as a bar spanning start→end, points as discs', () => {
  const { ctx, calls } = mockCtx()
  const red = abgr(255, 0, 0)
  // pos 100→101 = point (disc); 300→600 = 300bp = 30px span (> point) = bar.
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map([[0, data([100, 300], [5, 5], [red, red], [101, 600])]]),
    [block],
    state,
  )
  const arcs = calls.filter(c => c.kind === 'arc')
  const rects = calls.filter(
    (c): c is Extract<Call, { kind: 'rect' }> => c.kind === 'rect',
  )
  expect(arcs).toHaveLength(1)
  expect(rects).toHaveLength(1)
  // bp 300→600 maps to x 30→60 (10bp/px); score=5 → y=50.
  expect(rects[0]).toMatchObject({ x: 30, w: 30 })
  expect(rects[0]!.y + rects[0]!.h / 2).toBeCloseTo(50)
})

test('draws an insertion (glyph 1) as an inverted triangle, not a disc', () => {
  const { ctx, calls } = mockCtx()
  const red = abgr(255, 0, 0)
  // pos 500, point span, glyph=1 (insertion).
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map([[0, data([500], [5], [red], [501], [1])]]),
    [block],
    state,
  )
  const arcs = calls.filter(c => c.kind === 'arc')
  const lineTos = calls.filter(
    (c): c is Extract<Call, { kind: 'lineTo' }> => c.kind === 'lineTo',
  )
  expect(arcs).toHaveLength(0)
  // Triangle = two lineTo calls (apex + a corner) after the moveTo.
  expect(lineTos).toHaveLength(2)
  // Apex points down: x centered on bp=500 → x=50, below the score y=50.
  expect(lineTos[1]).toMatchObject({ x: 50 })
  expect(lineTos[1]!.y).toBeGreaterThan(50)
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
  expect(fills).toEqual(['rgba(255,0,0,1)', 'rgba(0,0,255,1)'])
})

test('preserves alpha so semi-transparent points match GPU output', () => {
  const { ctx, calls } = mockCtx()
  const halfRed = abgr(255, 0, 0, 128)
  drawManhattanBlocks(
    ctx as unknown as CanvasRenderingContext2D,
    new Map([[0, data([100], [5], [halfRed])]]),
    [block],
    state,
  )
  const fills = calls.flatMap(c => (c.kind === 'fillStyle' ? [c.value] : []))
  expect(fills).toEqual([`rgba(255,0,0,${128 / 255})`])
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

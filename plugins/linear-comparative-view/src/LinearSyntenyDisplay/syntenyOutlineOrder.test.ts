import { createCanvas } from 'canvas'

import { buildSyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { viewportWindow } from '../LinearSyntenyRPC/testUtils.ts'
import { drawSyntenyTrack } from './drawSyntenyTrack.ts'

const VIEW_W = 800
const HEIGHT = 100
const BP_PER_PX = 1000

function twoOverlappingFeatures() {
  const window = viewportWindow({
    viewOff: 0,
    viewWidth: VIEW_W,
    bpPerPx: 1000,
  })
  return buildSyntenyGeometry({
    p11_cumBp: Float64Array.from([100_000, 150_000]),
    p12_cumBp: Float64Array.from([400_000, 450_000]),
    p21_cumBp: Float64Array.from([100_000, 150_000]),
    p22_cumBp: Float64Array.from([400_000, 450_000]),
    queryGridAnchors: Float64Array.from([0, 0]),
    strands: Int8Array.from([1, 1]),
    parsedCigars: [[], []],
    cigarMode: 'full',
    bpPerPx0: BP_PER_PX,
    bpPerPx1: BP_PER_PX,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: VIEW_W,
    window0: window,
    window1: window,
  })
}

test('the clicked outline strokes after every fill, so no later ribbon covers it', () => {
  const g = twoOverlappingFeatures()
  const ctx = createCanvas(VIEW_W, HEIGHT).getContext('2d')
  const ops: string[] = []
  const recording = new Proxy(ctx, {
    get(target, key) {
      const value = Reflect.get(target, key, target)
      if (key === 'fill' || key === 'stroke') {
        return () => {
          ops.push(`${key} ${String(target.strokeStyle)}`)
        }
      }
      return typeof value === 'function' ? value.bind(target) : value
    },
    set(target, key, value) {
      return Reflect.set(target, key, value, target)
    },
  })
  drawSyntenyTrack(
    recording,
    { ...g, colors: new Uint32Array(g.kinds.length).fill(0xff0000ff) },
    {
      yTop: 0,
      height: HEIGHT,
      alpha: 0.5,
      hoveredFeatureId: 0,
      clickedFeatureId: 1,
      offsetPx0: 0,
      offsetPx1: 0,
      bpPerPx0: BP_PER_PX,
      bpPerPx1: BP_PER_PX,
      drawCurves: false,
      fadeThinAlignments: false,
    },
    VIEW_W,
    300,
    '#fff',
  )
  const fills = ops.filter(op => op.startsWith('fill'))
  const lastFill = ops.lastIndexOf(fills.at(-1)!)
  const outlineStrokes = ops
    .map((op, i) => [op, i] as const)
    .filter(([op]) => op.startsWith('stroke'))
  expect(fills).toHaveLength(2)
  expect(outlineStrokes.length).toBeGreaterThan(0)
  for (const [, i] of outlineStrokes) {
    expect(i).toBeGreaterThan(lastFill)
  }
})

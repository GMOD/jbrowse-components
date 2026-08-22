import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import { triangleDataToScreen } from '@jbrowse/plugin-linear-genome-view'

import { packTestInstances } from '../../testInstances.ts'
import { drawHicBlocks } from './Canvas2DHicRenderer.ts'

// `triangleDataToScreen` is hic.slang's vs_main, which the GPU and (via
// ctx.rotate/scale) the Canvas2D path both implement: rotate the bin into the
// triangle first, THEN apply the viewport scale and the fit-to-height squash.
// It was a private copy in this file until `model.hitTest`'s inverse needed the
// same map to be checkable against.
function shaderScreenPos(x: number, y: number, yScalar: number) {
  const { x: sx, y: sy } = triangleDataToScreen(x, y, {
    viewScale: 1,
    viewOffsetX: 0,
    yScalar,
    yOffsetPx: 0,
  })
  return { sx, sy }
}

function exportBin(yScalar: number) {
  const ctx = new SvgCanvas()
  drawHicBlocks(
    ctx,
    {
      instances: packTestInstances([100, 100], [1]),
      numContacts: 1,
      binWidth: 10,
    },
    () => 'rgb(1,2,3)',
    {
      yScalar,
      colorMaxScore: 1,
      useLogScale: false,
      viewScale: 1,
      viewOffsetX: 0,
    },
    // wide enough that the cull can't be what makes the assertions pass
    10_000,
  )
  const svg = ctx.getSerializedSvg()
  const [w, h] = /width="(\S+)" height="(\S+)"/
    .exec(svg)!
    .slice(1, 3)
    .map(Number)
  const m = /matrix\(([^)]*)\)/.exec(svg)![1]!.split(' ').map(Number)
  return {
    // the bin's origin corner, i.e. what a renderer draws
    x: m[4]!,
    y: m[5]!,
    // the bin's two edge vectors, a square only when the scale is uniform
    edges: [
      [m[0]! * w!, m[1]! * w!],
      [m[2]! * h!, m[3]! * h!],
    ],
  }
}

test.each([1, 2, 0.5])('svg export matches shader geometry, yScalar %p', s => {
  const { sx, sy } = shaderScreenPos(100, 100, s)
  const bin = exportBin(s)
  expect(bin.x).toBeCloseTo(sx, 6)
  expect(bin.y).toBeCloseTo(sy, 6)
})

// A squashed triangle's bins are parallelograms: the 45° rotation happens
// before the y-only scale, so the two edges are no longer perpendicular.
test('fit-to-height bins carry the post-rotation squash', () => {
  const c = Math.SQRT1_2 * 10
  expect(exportBin(2).edges).toEqual([
    [expect.closeTo(c, 6), expect.closeTo(-2 * c, 6)],
    [expect.closeTo(c, 6), expect.closeTo(2 * c, 6)],
  ])
})

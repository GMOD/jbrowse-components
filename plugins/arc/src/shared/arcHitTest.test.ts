import { SimpleFeature } from '@jbrowse/core/util'
import { ARC_HIT_SLOP_PX } from '@jbrowse/sv-core'

import { hitTestArcs } from './arcHitTest.ts'
import { arcExtent } from './arcLayout.ts'

import type { ArcTick, LaidOutArc } from './arcLayout.ts'
import type { ArcShape } from './arcShape.ts'

// What SVG's `pointer-events: stroke` used to answer for free. The cases that
// matter are the EDGES of the target — a hover test that only samples an arc's
// midpoint passes against a hit test with any tolerance at all, including one
// with none.

function arc(
  id: string,
  shape: ArcShape,
  strokeWidth = 2,
  ticks?: ArcTick[],
): LaidOutArc {
  return {
    feature: new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 0,
      end: 1,
    }),
    key: id,
    shape,
    color: 'darkblue',
    strokeWidth,
    selected: false,
    ticks,
    ...arcExtent(shape, strokeWidth, ticks),
  }
}

// wide enough that no fixture below is culled by it
const VIEW_W = 1000

const dome = (left: number, right: number, height = 100): ArcShape => ({
  kind: 'bezier',
  left,
  right,
  height,
})

test('the apex of an arc answers, and the empty band under it does not', () => {
  const a = arc('a', dome(0, 400))
  // apex of a bezier is 0.75 * height
  expect(hitTestArcs(200, 75, [a], VIEW_W)?.key).toBe('a')
  expect(hitTestArcs(200, 40, [a], VIEW_W)).toBeUndefined()
})

test('the target ends at the stroke plus the slop, and not before', () => {
  const strokeWidth = 4
  const a = arc('a', dome(0, 400), strokeWidth)
  const apex = 75
  const reach = strokeWidth / 2 + ARC_HIT_SLOP_PX
  // Sabotaging the `strokeWidth / 2` term or the slop moves one of these two.
  expect(hitTestArcs(200, apex - reach + 0.2, [a], VIEW_W)?.key).toBe('a')
  expect(hitTestArcs(200, apex - reach - 0.5, [a], VIEW_W)).toBeUndefined()
})

test('a thicker arc has a proportionally bigger target', () => {
  const thin = arc('thin', dome(0, 400), 1)
  const fat = arc('fat', dome(0, 400), 20)
  const y = 75 - 8
  expect(hitTestArcs(200, y, [thin], VIEW_W)).toBeUndefined()
  expect(hitTestArcs(200, y, [fat], VIEW_W)?.key).toBe('fat')
})

test('a reversed arc is hit where it is drawn', () => {
  // a reversed displayed region puts `left` past `right`; the ink is the same
  const a = arc('a', dome(400, 0))
  expect(hitTestArcs(200, 75, [a], VIEW_W)?.key).toBe('a')
})

test('a direction tick is hoverable, and reaches past its own foot', () => {
  const ticks: ArcTick[] = [{ x1: 100, x2: 120, y: 1.5 }]
  const a = arc('a', dome(100, 500), 2, ticks)
  // over the tick, well outside the curve — and past the foot, which is what
  // the extent has to have widened for
  expect(hitTestArcs(115, 1.5, [a], VIEW_W)?.key).toBe('a')
  expect(hitTestArcs(119, 1.5, [a], VIEW_W)?.key).toBe('a')
  expect(hitTestArcs(140, 1.5, [a], VIEW_W)).toBeUndefined()
})

test('two arcs on the same ink: the later-painted one wins', () => {
  const under = arc('under', dome(0, 400))
  const over = arc('over', dome(0, 400))
  expect(hitTestArcs(200, 75, [under, over], VIEW_W)?.key).toBe('over')
  expect(hitTestArcs(200, 75, [over, under], VIEW_W)?.key).toBe('under')
})

test('near two arcs but on neither: the nearer ink wins whatever the order', () => {
  const near = arc('near', dome(0, 400, 100))
  const far = arc('far', dome(0, 400, 92))
  // apexes at 75 and 69; sit 1px above the taller one
  expect(hitTestArcs(200, 74, [far, near], VIEW_W)?.key).toBe('near')
  expect(hitTestArcs(200, 74, [near, far], VIEW_W)?.key).toBe('near')
})

test('an arc whose column the cursor is nowhere near is skipped', () => {
  const left = arc('left', dome(0, 100))
  const right = arc('right', dome(600, 900))
  expect(hitTestArcs(750, 75, [left, right], VIEW_W)?.key).toBe('right')
  // between the two, over neither
  expect(hitTestArcs(300, 40, [left, right], VIEW_W)).toBeUndefined()
})

test('an arc the painter culled answers nothing, slop included', () => {
  // Ink from -400 to -6, half a 2px stroke either side, so the rightmost ink is
  // at x = -5 and none of it is drawn. Without the cull the slop lets it answer
  // a hover 2px inside the viewport, which is a hit on ink nobody can see.
  const off = arc('off', dome(-400, -6))
  expect(off.xMax).toBeLessThan(0)
  expect(hitTestArcs(0, 0, [off], VIEW_W)).toBeUndefined()
  expect(hitTestArcs(2, 2, [off], VIEW_W)).toBeUndefined()

  // and the boundary is exact: an arc whose last pixel of ink lands ON x=0 is
  // drawn, so it still answers
  const edge = arc('edge', dome(-400, -1))
  expect(edge.xMax).toBe(0)
  expect(hitTestArcs(0, 0, [edge], VIEW_W)?.key).toBe('edge')
})

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

const dome = (left: number, right: number, height = 100): ArcShape => ({
  kind: 'bezier',
  left,
  right,
  height,
})

test('the apex of an arc answers, and the empty band under it does not', () => {
  const a = arc('a', dome(0, 400))
  // apex of a bezier is 0.75 * height
  expect(hitTestArcs(200, 75, [a])?.key).toBe('a')
  expect(hitTestArcs(200, 40, [a])).toBeUndefined()
})

test('the target ends at the stroke plus the slop, and not before', () => {
  const strokeWidth = 4
  const a = arc('a', dome(0, 400), strokeWidth)
  const apex = 75
  const reach = strokeWidth / 2 + ARC_HIT_SLOP_PX
  // Sabotaging the `strokeWidth / 2` term or the slop moves one of these two.
  expect(hitTestArcs(200, apex - reach + 0.2, [a])?.key).toBe('a')
  expect(hitTestArcs(200, apex - reach - 0.5, [a])).toBeUndefined()
})

test('a thicker arc has a proportionally bigger target', () => {
  const thin = arc('thin', dome(0, 400), 1)
  const fat = arc('fat', dome(0, 400), 20)
  const y = 75 - 8
  expect(hitTestArcs(200, y, [thin])).toBeUndefined()
  expect(hitTestArcs(200, y, [fat])?.key).toBe('fat')
})

test('a reversed arc is hit where it is drawn', () => {
  // a reversed displayed region puts `left` past `right`; the ink is the same
  const a = arc('a', dome(400, 0))
  expect(hitTestArcs(200, 75, [a])?.key).toBe('a')
})

test('a direction tick is hoverable, and reaches past its own foot', () => {
  const ticks: ArcTick[] = [{ x1: 100, x2: 120, y: 1.5 }]
  const a = arc('a', dome(100, 500), 2, ticks)
  // over the tick, well outside the curve — and past the foot, which is what
  // the extent has to have widened for
  expect(hitTestArcs(115, 1.5, [a])?.key).toBe('a')
  expect(hitTestArcs(119, 1.5, [a])?.key).toBe('a')
  expect(hitTestArcs(140, 1.5, [a])).toBeUndefined()
})

test('two arcs on the same ink: the later-painted one wins', () => {
  const under = arc('under', dome(0, 400))
  const over = arc('over', dome(0, 400))
  expect(hitTestArcs(200, 75, [under, over])?.key).toBe('over')
  expect(hitTestArcs(200, 75, [over, under])?.key).toBe('under')
})

test('near two arcs but on neither: the nearer ink wins whatever the order', () => {
  const near = arc('near', dome(0, 400, 100))
  const far = arc('far', dome(0, 400, 92))
  // apexes at 75 and 69; sit 1px above the taller one
  expect(hitTestArcs(200, 74, [far, near])?.key).toBe('near')
  expect(hitTestArcs(200, 74, [near, far])?.key).toBe('near')
})

test('an arc whose column the cursor is nowhere near is skipped', () => {
  const left = arc('left', dome(0, 100))
  const right = arc('right', dome(600, 900))
  expect(hitTestArcs(750, 75, [left, right])?.key).toBe('right')
  // between the two, over neither
  expect(hitTestArcs(300, 40, [left, right])).toBeUndefined()
})

import { SimpleFeature } from '@jbrowse/core/util'

import { layOutArcs } from './arcLayout.ts'
import { createTestEnvironment } from './testEnv.ts'

// What `layOutArcs` promises about the list it hands back: everything in it
// paints. That list is the hit test's input as well as the painter's, so an
// entry with no ink answers a hover and a click over nothing on screen — which
// is the same defect as an arc that paints when the config said not to.

const hideBelowSix = createTestEnvironment({
  thickness: `jexl:get(feature,'score')>5?3:0`,
})
const negativeThickness = createTestEnvironment({ thickness: -4 })
const thicknessOfNothing = createTestEnvironment({
  thickness: `jexl:get(feature,'missing')`,
})
const heightOfNothing = createTestEnvironment({
  arcHeight: `jexl:get(feature,'missing')`,
})

function feature(uniqueId: string, score?: number) {
  return new SimpleFeature({
    uniqueId,
    refName: 'ctgA',
    start: 100,
    end: 2000,
    score,
  })
}

// The expression form the arc docs suggest for hiding low-score features. A
// stroke fallback that answered 1px for anything unpaintable took the 0 with
// it, so every arc the user meant to hide came back at a hairline.
test('a thickness of 0 hides that arc and only that arc', () => {
  const { display } = hideBelowSix.createDisplay()
  display.setFeatures([feature('low', 1), feature('high', 10)])
  expect(display.laidOutArcs.map(a => a.key)).toEqual(['high'])
})

test('a negative thickness hides the arc rather than painting a hairline', () => {
  const { display } = negativeThickness.createDisplay()
  display.setFeatures([feature('f1', 10)])
  expect(display.laidOutArcs).toEqual([])
})

// A broken expression is not an instruction to hide anything, so the fallback
// still stands where the thickness is no number at all.
test('a thickness with no number behind it paints at the default width', () => {
  const { display } = thicknessOfNothing.createDisplay()
  display.setFeatures([feature('f1', 10)])
  expect(display.laidOutArcs[0]!.strokeWidth).toBe(1)
})

// Same for the height, where flat is what a 1bp feature already gets. The arc
// stays: it spans two different pixels, so there is ink along the baseline.
test('an arcHeight with no number behind it lays the arc flat', () => {
  const { display } = heightOfNothing.createDisplay()
  display.setFeatures([feature('f1', 10)])
  const { shape, xMin, xMax } = display.laidOutArcs[0]!
  expect(shape).toMatchObject({ kind: 'bezier', height: 0 })
  expect(xMax - xMin).toBeGreaterThan(0)
})

// Both halves of "neither display may build a `LaidOutArc`": the `never` on
// `ArcParts` is what fails the compile, since TypeScript does not
// excess-property-check a literal returned from a callback, and spread order is
// what makes it harmless if a cast gets one past that.
test('a display cannot supply the fields layOutArcs derives', () => {
  const { display } = hideBelowSix.createDisplay()
  const f = feature('f1', 10)
  const arcs = layOutArcs(display, [f], (style, place) => ({
    feature: style,
    key: style.id(),
    shape: {
      kind: 'bezier',
      left: place('ctgA', 100)!.x,
      right: place('ctgA', 2000)!.x,
      height: 10,
    },
    color: 'darkblue',
    strokeWidth: 2,
    // @ts-expect-error a display supplies what the two displays disagree
    // about, never what `layOutArcs` derives
    selected: true,
  }))
  expect(arcs[0]!.selected).toBe(false)
})

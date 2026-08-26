import { SimpleFeature } from '@jbrowse/core/util'

import { axisSpan } from './anchorAxis.ts'
import { createDisplay } from './testEnv.ts'

// The harness displays `ctgA:0..1000` and nothing else, which is the shape a
// launched panel, a bookmarked region and a synteny row all have: a slice of a
// contig rather than the whole thing.
function pairFeature(start: number, end: number) {
  return new SimpleFeature({
    uniqueId: `${start}-${end}`,
    refName: 'ctgA',
    start,
    end,
    strand: 1,
    name: `g-${start}`,
    assemblyName: 'volvox',
    mate: {
      assemblyName: 'volvox_random',
      refName: 'ctgB',
      start: 5000 + start,
      end: 5000 + end,
      name: `m-${start}`,
    },
  })
}

test('an interval straddling the displayed region draws the half on the axis', () => {
  const view = createDisplay().lgv

  // what makes this worth clipping: `bpToPx` answers only for a coord INSIDE a
  // displayed region, so the far end of a straddler has no answer at all
  expect(view.bpToPx({ refName: 'ctgA', coord: 1500 })).toBeUndefined()

  const inside = axisSpan(view, 'ctgA', 100, 200)
  const straddling = axisSpan(view, 'ctgA', 900, 1500)
  expect(inside).toBeDefined()
  expect(straddling).toBeDefined()
  // clipped to the region's own end, which is where the axis stops
  expect(straddling![1]).toBe(axisSpan(view, 'ctgA', 900, 1000)![1])
})

test('an interval no displayed region reaches has no span', () => {
  const view = createDisplay().lgv
  expect(axisSpan(view, 'ctgA', 2000, 3000)).toBeUndefined()
  expect(axisSpan(view, 'ctgZ', 100, 200)).toBeUndefined()
})

// The whole reason the anchor axis has to clip rather than test: a group that
// loses its anchor span is dropped from the ribbons AND from `anchorSeedX`, the
// seed every lane below lines up against — while the mate lanes go on drawing
// its placement, so the picture states a correspondence with one end missing.
test('a group straddling the region edge keeps its anchor span and its seed', () => {
  const display = createDisplay()
  display.setFeatures([pairFeature(100, 200), pairFeature(700, 1500)])

  expect(display.groups.map(g => g.key)).toEqual(['g-100', 'g-700'])
  expect([...display.anchorSpans.keys()]).toEqual(['g-100', 'g-700'])
  expect([...display.anchorSeedX.keys()]).toEqual(['g-100', 'g-700'])
})

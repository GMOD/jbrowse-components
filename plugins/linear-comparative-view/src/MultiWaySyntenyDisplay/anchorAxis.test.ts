import { SimpleFeature } from '@jbrowse/core/util'

import { axisSpan, axisSpans, displayedRegionSpans } from './anchorAxis.ts'
import { createDisplay } from './testEnv.ts'

// The harness displays ctgA:0..1000 and nothing else.
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

  expect(view.bpToPx({ refName: 'ctgA', coord: 1500 })).toBeUndefined()

  const inside = axisSpan(view, 'ctgA', 100, 200)
  const straddling = axisSpan(view, 'ctgA', 900, 1500)
  expect(inside).toBeDefined()
  expect(straddling).toBeDefined()
  expect(straddling![1]).toBe(axisSpan(view, 'ctgA', 900, 1000)![1])
})

test('an interval no displayed region reaches has no span', () => {
  const view = createDisplay().lgv
  expect(axisSpan(view, 'ctgA', 2000, 3000)).toBeUndefined()
  expect(axisSpan(view, 'ctgZ', 100, 200)).toBeUndefined()
})

test('a group straddling the region edge keeps its anchor span and its seed', () => {
  const display = createDisplay()
  display.setFeatures([pairFeature(100, 200), pairFeature(700, 1500)])

  expect(display.groups.map(g => g.key)).toEqual(['g-100', 'g-700'])
  expect([...display.anchorSpans.keys()]).toEqual(['g-100', 'g-700'])
  expect([...display.anchorAbsX.keys()]).toEqual(['g-100', 'g-700'])
})

test('each displayed region spans what axisSpan maps the whole region to', () => {
  const view = createDisplay().lgv
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 300, assemblyName: 'volvox' },
    {
      refName: 'ctgA',
      start: 500,
      end: 800,
      assemblyName: 'volvox',
      reversed: true,
    },
    { refName: 'ctgB', start: 0, end: 200, assemblyName: 'volvox' },
  ])
  expect(displayedRegionSpans(view, 40)).toEqual(
    view.displayedRegions.map(r =>
      axisSpan(view, r.refName, r.start, r.end, 40),
    ),
  )
})

test('an interval across two displayed regions of one refName opens a gap at the seam', () => {
  const view = createDisplay().lgv
  view.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 400 },
    {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 600,
      end: 1000,
      reversed: true,
    },
  ])
  const spans = axisSpans(view, 'ctgA', 300, 700)
  const seam = axisSpan(view, 'ctgA', 399, 400)![1]
  expect(spans).toHaveLength(2)
  expect(spans[0]![1]).toBe(seam)
  // the reversed region reads right to left from its end at the seam
  expect(spans[1]![0]).toBeGreaterThan(spans[1]![1])
  expect(Math.max(...spans[1]!)).toBeLessThanOrEqual(seam + 400 / view.bpPerPx)
})

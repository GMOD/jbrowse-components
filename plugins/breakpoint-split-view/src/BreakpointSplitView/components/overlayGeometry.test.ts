import { computeOverlayRect } from './overlayGeometry.ts'

import type { LayoutRecord, OverlayLevel } from '../types.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'

const OFFSCREEN_Y = Number.POSITIVE_INFINITY

const viewLayout: ViewLayout = {
  displayedRegions: [
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'volvox' },
  ],
  bpPerPx: 1,
  offsetPx: 0,
  width: 500,
  minimumBlockWidth: 3,
}

const level: OverlayLevel = {
  yOffset: 100,
  height: 200,
  coverageOffset: 40,
  scrollTop: 0,
  offsetPx: 0,
  linksReads: false,
}

const rect = (layout: LayoutRecord, overrides?: Partial<OverlayLevel>) =>
  computeOverlayRect({
    level: { ...level, ...overrides },
    layout,
    refName: 'chr1',
    viewLayout,
  })

test('boxes a laid-out read at its own span, below the coverage subtrack', () => {
  expect(rect([100, 10, 200, 20])).toEqual({
    x: 100,
    y: 150,
    width: 100,
    height: 10,
  })
})

test('the vertical scroll moves the box with the read', () => {
  expect(rect([100, 60, 200, 70], { scrollTop: 30 })).toEqual({
    x: 100,
    y: 170,
    width: 100,
    height: 10,
  })
})

test('a read scrolled above the pileup has no box', () => {
  expect(rect([100, 10, 200, 20], { scrollTop: 100 })).toBeUndefined()
})

test('a read scrolled below the pileup has no box', () => {
  expect(rect([100, 400, 200, 410], { scrollTop: 0 })).toBeUndefined()
})

test('an off-display segment has no box — its connector is the only mark', () => {
  expect(rect([100, OFFSCREEN_Y, 200, OFFSCREEN_Y])).toBeUndefined()
})

test('a read running past the panel edges is clamped to the panel', () => {
  const layout: LayoutRecord = [-200, 10, 900, 20]
  expect(rect(layout)).toEqual({ x: 0, y: 150, width: 500, height: 10 })
})

test('a read entirely off the panel has no box', () => {
  expect(rect([700, 10, 800, 20])).toBeUndefined()
})

// The reason this goes through getLayoutHighlightCoords rather than a bpToPx per
// edge: bpToPx answers undefined for a coordinate no displayed region covers, so
// a long read hanging off the region would lose its box entirely.
test('a read hanging past the displayed region keeps the half that is inside', () => {
  const clipped: ViewLayout = {
    ...viewLayout,
    displayedRegions: [
      { refName: 'chr1', start: 100, end: 400, assemblyName: 'volvox' },
    ],
  }
  expect(
    computeOverlayRect({
      level,
      layout: [50, 10, 250, 20],
      refName: 'chr1',
      viewLayout: clipped,
    }),
  ).toEqual({ x: 0, y: 150, width: 150, height: 10 })
})

test('a sub-pixel read keeps a visible box', () => {
  const zoomedOut: ViewLayout = { ...viewLayout, bpPerPx: 1000 }
  expect(
    computeOverlayRect({
      level,
      layout: [100, 10, 200, 20],
      refName: 'chr1',
      viewLayout: zoomedOut,
    })?.width,
  ).toBe(3)
})

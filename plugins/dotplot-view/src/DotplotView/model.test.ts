import { getSession } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// self-vs-self layout: both axes show ctgA at bpPerPx=1, offsetPx=0. borderY is
// now derived from the axis labels, so tests read model.viewHeight rather than
// assuming a fixed border.
function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'DotplotView',
          height: 600,
          assemblyNames: ['volvox', 'volvox'],
          hview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
          vview: {
            bpPerPx: 1,
            offsetPx: 0,
            displayedRegions: [
              { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
            ],
          },
        },
      ],
    },
  }) as any
  return session.views[0]
}

test('getHHighlightCoords maps a region to px on the horizontal axis', () => {
  const model = setup()
  expect(
    model.getHHighlightCoords({ refName: 'ctgA', start: 100, end: 200 }),
  ).toEqual({ left: 100, width: 100 })
})

test('getVHighlightCoords flips the band into screen space', () => {
  const model = setup()
  // top = viewHeight - (left 100 + width 100)
  expect(
    model.getVHighlightCoords({ refName: 'ctgA', start: 100, end: 200 }),
  ).toEqual({ top: model.viewHeight - 200, height: 100 })
})

test('off-axis region returns undefined', () => {
  const model = setup()
  expect(
    model.getHHighlightCoords({ refName: 'ctgZ', start: 100, end: 200 }),
  ).toBeUndefined()
  expect(
    model.getVHighlightCoords({ refName: 'ctgZ', start: 100, end: 200 }),
  ).toBeUndefined()
})

test('addHighlightFromMouseCoords bands the drag rect on both axes', () => {
  const model = setup()
  const { viewHeight } = model
  // drag from (100, viewHeight-200) to (300, viewHeight-400): x-span 100-300 on
  // the h axis, y-span 200-400 on the v axis (which lays out bottom-to-top)
  model.addHighlightFromMouseCoords(
    [100, viewHeight - 200],
    [300, viewHeight - 400],
  )
  expect(model.highlight).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 100, end: 300 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 200, end: 400 },
  ])
})

test('addHighlightFromMouseCoords clamps a drag past the region edges', () => {
  const model = setup()
  const { viewHeight } = model
  // ctgA is 0-1000 at bpPerPx=1, so both ends of this drag run off the region
  model.addHighlightFromMouseCoords(
    [-50, viewHeight + 50],
    [1200, viewHeight - 1200],
  )
  expect(model.highlight).toEqual([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
  ])
})

test('a drag under the 3px threshold adds no highlight', () => {
  const model = setup()
  model.addHighlightFromMouseCoords([100, 100], [102, 102])
  expect(model.highlight).toHaveLength(0)
})

test('settled gates on autoDiagonalize completion when requested', () => {
  const model = setup()
  model.markCanvasDrawn()
  // nothing requested: settled once the canvas is drawn (no displays loading)
  expect(model.settled).toBe(true)

  // an init-time reorder is requested: the plot is NOT done until it completes,
  // so a screenshot/browser-test can't capture the pre-diagonalize plot
  model.setAutoDiagonalizeRequested(true)
  expect(model.settled).toBe(false)

  // reorder resolved successfully: settled is released
  model.setAutoDiagonalizeComplete(true)
  expect(model.settled).toBe(true)
})

test('highlight actions add/remove and toggle visibility', () => {
  const model = setup()
  const h = { refName: 'ctgA', start: 0, end: 10, assemblyName: 'volvox' }
  model.addToHighlights(h)
  expect(model.highlight.length).toBe(1)
  const session = getSession(model)
  expect(session.highlightsVisible).toBe(true)
  session.setHighlightsVisible(false)
  expect(session.highlightsVisible).toBe(false)
  model.removeHighlight(model.highlight[0])
  expect(model.highlight.length).toBe(0)
})

// @ts-expect-error
import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

// self-vs-self layout: both axes show ctgA at bpPerPx=1, offsetPx=0.
// height 600 - borderY 100 => viewHeight 500.
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

test('highlight actions add/remove and toggle visibility', () => {
  const model = setup()
  const h = { refName: 'ctgA', start: 0, end: 10, assemblyName: 'volvox' }
  model.addToHighlights(h)
  expect(model.highlight.length).toBe(1)
  expect(model.highlightsVisible).toBe(true)
  model.setHighlightsVisible(false)
  expect(model.highlightsVisible).toBe(false)
  model.removeHighlight(model.highlight[0])
  expect(model.highlight.length).toBe(0)
})

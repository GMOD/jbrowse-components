import { createTestSession } from '@jbrowse/web/testUtils'

import type { GridBookmarkModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const view = {
    type: 'LinearGenomeView',
    bpPerPx: 1,
    offsetPx: 0,
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
  }
  const session = createTestSession({
    sessionSnapshot: { views: [view, view] },
  }) as any
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  return { session, widget }
}

test('visibility getters aggregate across every open view, not just the first', () => {
  const { session, widget } = setup()
  expect(widget.areBookmarksHighlightedOnAllOpenViews).toBe(true)

  // toggling the SECOND view alone must flip the getter; a getter that only
  // inspected views[0] would miss this (the bug the everyView traversal fixes)
  session.views[1].setBookmarkHighlightsVisible(false)
  expect(widget.areBookmarksHighlightedOnAllOpenViews).toBe(false)

  session.views[1].setBookmarkHighlightsVisible(true)
  expect(widget.areBookmarksHighlightedOnAllOpenViews).toBe(true)
})

test('label-visibility getter likewise aggregates across all views', () => {
  const { session, widget } = setup()
  expect(widget.areBookmarksHighlightLabelsOnAllOpenViews).toBe(true)

  session.views[1].setLabelsVisible(false)
  expect(widget.areBookmarksHighlightLabelsOnAllOpenViews).toBe(false)
})

test('setBookmarkHighlightsVisible toggles every view', () => {
  const { session, widget } = setup()
  widget.setBookmarkHighlightsVisible(false)
  expect(session.views.every((v: any) => !v.bookmarkHighlightsVisible)).toBe(
    true,
  )
})

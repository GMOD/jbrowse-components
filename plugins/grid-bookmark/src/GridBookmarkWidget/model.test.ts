import { createTestSession } from '@jbrowse/web/testUtils'

import { getBookmarkHighlights } from './components/Highlight/getBookmarkHighlights.ts'

import type { GridBookmarkModel, IExtendedLGV } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// bookmarks are localStorage-backed, so isolate tests from each other
beforeEach(() => {
  localStorage.clear()
})

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

test('highlightsVisible is a single session-level flag gating overlays', () => {
  const { session, widget } = setup()
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  const view = session.views[0] as IExtendedLGV

  // on by default, so the view's bookmark overlay resolves the bookmark
  expect(session.highlightsVisible).toBe(true)
  expect(getBookmarkHighlights(view).bookmarks).toHaveLength(1)

  // flipping the one flag hides overlays everywhere
  session.setHighlightsVisible(false)
  expect(getBookmarkHighlights(view).bookmarks).toHaveLength(0)
})

test('visibleBookmarks only includes assemblies open in a view', () => {
  const { widget } = setup()
  expect([...widget.assembliesInViews]).toEqual(['volvox'])

  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  widget.addBookmark({
    assemblyName: 'other-asm',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })

  expect(widget.bookmarks).toHaveLength(2)
  expect(widget.visibleBookmarks.map(b => b.assemblyName)).toEqual(['volvox'])
})

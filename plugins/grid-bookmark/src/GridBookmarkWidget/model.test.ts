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

test('a new bookmark reveals the bands so it is not silently swallowed', () => {
  const { session, widget } = setup()
  session.setHighlightsVisible(false)
  widget.addBookmark({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(session.highlightsVisible).toBe(true)
  expect(
    getBookmarkHighlights(session.views[0] as IExtendedLGV).bookmarks,
  ).toHaveLength(1)

  // an imported file reveals too; the reveal watches the list, not the caller
  session.setHighlightsVisible(false)
  widget.importBookmarks([
    { assemblyName: 'volvox', refName: 'ctgA', start: 200, end: 300 },
  ])
  expect(session.highlightsVisible).toBe(true)

  // recoloring from the grid reveals too: the grid lists bookmarks with the
  // overlays off, so the picked color would otherwise go nowhere
  session.setHighlightsVisible(false)
  const region = widget.bookmarks[0]!
  // the grid row shape BookmarkGrid builds, which is what the color picker
  // hands back
  widget.updateBookmarkHighlight(
    { ...region, id: 0, correspondingObj: region },
    'rgb(255,0,0)',
  )
  expect(region.highlight).toBe('rgb(255,0,0)')
  expect(session.highlightsVisible).toBe(true)

  // deleting must not re-reveal, otherwise the toggle can't be turned off
  session.setHighlightsVisible(false)
  widget.removeBookmarkObject(widget.bookmarks[0]!)
  expect(session.highlightsVisible).toBe(false)
})

test('loading stored bookmarks does not override a persisted bands-off', () => {
  const { session } = setup()
  session.setHighlightsVisible(false)
  // a widget created with bookmarks already present must not reveal: the count
  // is seeded at attach, so only growth after that counts
  const widget = session.addWidget('GridBookmarkWidget', 'GridBookmark2', {
    bookmarks: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
    ],
  }) as GridBookmarkModel
  expect(widget.bookmarks).toHaveLength(1)
  expect(session.highlightsVisible).toBe(false)
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

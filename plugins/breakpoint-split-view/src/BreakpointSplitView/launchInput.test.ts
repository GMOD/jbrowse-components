import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const warnings = () => warn.mock.calls.map(c => `${c[0]}`)

// `width` is a volatile with a default, so the init autorun fires at attach and
// the panels are already built by the time `addView` returns — which is why the
// assertions below read `views` rather than a pending blob.
function open(snap: Record<string, unknown>) {
  return createTestSession().addView(
    'BreakpointSplitView',
    snap,
  ) as BreakpointViewModel
}

const PANELS = [
  { assembly: 'volvox', loc: 'ctgA:1-100' },
  { assembly: 'volvox', loc: 'ctgA:200-300' },
]

test('a launch key written on the view object opens the panels', () => {
  const view = open({ views: PANELS })
  expect(view.views).toHaveLength(2)
  expect(view.views.map(v => v.launch)).toEqual(PANELS)
  expect(warnings()).toEqual([])
})

// Nothing in this view's launch path mentions any of these names: v4 resolved
// the panel array and nothing else, so a declared property written beside it
// reached nothing.
test('a declared property lands natively, named nowhere in the launch path', () => {
  const view = open({
    views: PANELS,
    showIntraviewLinks: false,
    linkViews: true,
    interactiveOverlay: false,
    height: 900,
  })
  expect(view.showIntraviewLinks).toBe(false)
  expect(view.linkViews).toBe(true)
  expect(view.interactiveOverlay).toBe(false)
  expect(view.height).toBe(900)
})

describe('the v4 nested form', () => {
  const DEPRECATED =
    'BreakpointSplitView nests its settings under "init", which is deprecated: write every setting directly on the view object.'

  // `init` was a BARE ARRAY here, the one unkeyed blob in the tree. A
  // positional list can only be the row list, so it is read as `views` rather
  // than classified per index.
  test('a bare array under init opens its panels', () => {
    const view = open({ init: PANELS })
    expect(view.views).toHaveLength(PANELS.length)
    expect(warnings()).toEqual([DEPRECATED])
  })

  test('the keyed nested form opens them too', () => {
    expect(open({ init: { views: PANELS } }).views).toHaveLength(PANELS.length)
  })

  test('a declared property nested inside it lands', () => {
    const view = open({ init: { views: PANELS, height: 900 } })
    expect(view.height).toBe(900)
    expect(warnings()).toEqual([DEPRECATED])
  })
})

test('a key naming neither a launch key nor a property is named on attach', () => {
  open({ views: PANELS, showIntraViewLinks: false })
  expect(warnings()).toContain(
    'BreakpointSplitView ignored unknown key(s): showIntraViewLinks',
  )
})

test('an unknown key is reported once', () => {
  open({ showIntraViewLinks: false })
  expect(warnings()).toHaveLength(1)
})

// Read as work to do, `hasSomethingToShow` is true with no panels coming and
// the view sits on its spinner rather than dropping to the import form.
test('a typo alone leaves nothing pending', () => {
  const view = open({ showIntraViewLinks: false })
  expect(view.launch).toEqual({ unknown: { showIntraViewLinks: false } })
  expect(view.pendingLaunch).toBeUndefined()
  expect(view.hasSomethingToShow).toBe(false)
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(true)
})

describe('the rows discriminator', () => {
  const built = {
    type: 'LinearGenomeView',
    hideHeader: true,
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
    ],
  }

  test('a row carrying `type` is a built snapshot MST restores', () => {
    const view = open({ views: [built, built] })
    expect(view.views).toHaveLength(2)
    expect(view.views.map(v => v.launch)).toEqual([undefined, undefined])
    expect(view.views[0]!.displayedRegions).toHaveLength(1)
  })

  test('a row without one is a recipe the launcher opens', () => {
    const view = open({ views: PANELS })
    expect(view.views.map(v => v.launch)).toEqual(PANELS)
    expect(view.views[0]!.displayedRegions).toHaveLength(0)
  })

  test('a mixed list is refused whole rather than split', () => {
    const view = open({ views: [built, { assembly: 'volvox' }] })
    expect(view.views).toHaveLength(0)
    expect(view.launch?.views).toBeUndefined()
    expect(view.pendingLaunch).toBeUndefined()
    expect(view.showImportForm).toBe(true)
    expect(warnings()).toContain(
      'BreakpointSplitView refused views: the list mixes built view snapshots with recipes to open one, and the rows index against the levels between them. Write all of them one way.',
    )
  })
})

// The launch state rides the snapshot only while there are no panels, so an
// autosave firing mid-load can still rebuild the view. A refused list is the
// state that stays empty, so it is what shows the branch.
test('the launch state persists only while the panels are missing', () => {
  // postProcessSnapshot narrows `launch` out of the snapshot type, which is the
  // whole point of it; the cast is what lets the test look for it anyway
  const launchOf = (view: BreakpointViewModel) =>
    (getSnapshot(view) as { launch?: unknown }).launch
  const refused = open({
    views: [{ type: 'LinearGenomeView' }, { assembly: 'volvox' }],
  })
  expect(launchOf(refused)).toBeDefined()
  expect(launchOf(open({ views: PANELS }))).toBeUndefined()
})

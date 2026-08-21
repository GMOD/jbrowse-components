import { showRegionsWithUndo } from './showRegionsWithUndo.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { Region } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: (node: { session: unknown }) => node.session,
}))

const CTG_A = { assemblyName: 'volvox', refName: 'ctgA' }
const BEFORE: Region[] = [{ ...CTG_A, start: 0, end: 50_000 }]
const AFTER: Region[] = [
  { ...CTG_A, start: 100, end: 200 },
  { ...CTG_A, start: 900, end: 1000 },
]

// Records what it was asked to do, and models the one behavior that matters
// here: the window is stored in bp, and `width` is what turns it into pixels.
// Both movers route through that width the way the model's do — `setWindow`
// via zoomTo, `setNewView` via a bpPerPx it was handed — so the resize test
// below can actually fail. A fake whose setWindow just assigns its arguments
// passes whatever it is given.
function makeView(width = 800) {
  const view = {
    displayedRegions: BEFORE,
    windowWidthBp: 50_000,
    windowStartBp: 0,
    width,
    fits: 0,
    notifications: [] as { message: string; undo: () => void }[],
    setDisplayedRegions(regions: Region[]) {
      view.displayedRegions = regions
    },
    showRegions(regions: Region[]) {
      view.setDisplayedRegions(regions)
      view.fitAllRegions()
    },
    fitAllRegions() {
      view.fits++
      view.windowWidthBp = view.displayedRegions.reduce(
        (n, r) => n + (r.end - r.start),
        0,
      )
      view.windowStartBp = 0
    },
    get bpPerPx() {
      return view.windowWidthBp / view.width
    },
    get offsetPx() {
      return view.windowStartBp / view.bpPerPx
    },
    setWindow(windowWidthBp: number, windowStartBp: number) {
      // the model spells this zoomTo(windowWidthBp / width) then
      // scrollToBp(windowStartBp), so the width divides out and back
      view.windowWidthBp = (windowWidthBp / view.width) * view.width
      view.windowStartBp = windowStartBp
    },
    setNewView(bpPerPx: number, offsetPx: number) {
      view.windowWidthBp = bpPerPx * view.width
      view.windowStartBp = offsetPx * bpPerPx
    },
    session: {
      notify(message: string, _level: string, action: { onClick: () => void }) {
        view.notifications.push({ message, undo: action.onClick })
      },
    },
  }
  return view
}

function run(view: ReturnType<typeof makeView>, alsoUndo?: () => void) {
  showRegionsWithUndo({
    view: view as unknown as LinearGenomeViewModel,
    regions: AFTER,
    message: 'Showing something',
    alsoUndo,
  })
  return view.notifications[0]!
}

test('shows the regions, fits them, and offers an Undo', () => {
  const view = makeView()
  const { message } = run(view)

  expect(view.displayedRegions).toBe(AFTER)
  expect(view.fits).toBe(1)
  expect(message).toBe('Showing something')
})

test('Undo puts back the regions and the viewport', () => {
  const view = makeView()
  run(view).undo()

  expect(view.displayedRegions).toBe(BEFORE)
  expect(view.windowWidthBp).toBe(50_000)
  expect(view.windowStartBp).toBe(0)
})

// The reason the capture is a bp window and not `{bpPerPx, offsetPx}`: both
// copies of this used the pixel pair, and a resize between the click and the Undo
// reinterpreted it at the new width.
test('Undo restores the same window after a resize', () => {
  const view = makeView(800)
  view.windowStartBp = 12_000
  const { undo } = run(view)

  view.width = 1600
  undo()

  expect(view.windowWidthBp).toBe(50_000)
  expect(view.windowStartBp).toBe(12_000)
})

// What the test above is worth depends on the fake being able to fail it, so:
// the same capture and the same resize through the pair this used to store,
// which comes back at double the window it was taken at.
test('the pixel pair this replaced does not survive that resize', () => {
  const view = makeView(800)
  view.windowStartBp = 12_000
  const captured = { bpPerPx: view.bpPerPx, offsetPx: view.offsetPx }
  run(view)

  view.width = 1600
  view.setNewView(captured.bpPerPx, captured.offsetPx)

  expect(view.windowWidthBp).toBe(100_000)
})

test('Undo also reverses what the caller changed beyond the location', () => {
  const view = makeView()
  const alsoUndo = jest.fn()
  const { undo } = run(view, alsoUndo)

  expect(alsoUndo).not.toHaveBeenCalled()
  undo()
  expect(alsoUndo).toHaveBeenCalledTimes(1)
})

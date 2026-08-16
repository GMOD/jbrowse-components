import { types } from '@jbrowse/mobx-state-tree'
import { fireEvent, render, screen } from '@testing-library/react'

import { isLiveModel } from './isLiveModel.ts'
import plainChromeOverlays from './plainChromeOverlays.tsx'

// `chromeOverlays.ts` says the four model shapes are structural — "A display
// satisfies one by having the fields; no mixin has to be composed" — so a host
// writing their own display over `DisplayChromeBase` can hand these components a
// plain object. `isAlive` throws on one rather than answering, and it throws
// from inside a click handler, where React logs it and carries on: the Force
// load button stays on screen, looks live, and does nothing. That is the state
// `DisplayChromeOverlays.TooLarge` documents itself as existing to prevent, so
// the failure is worth a test rather than a comment.

const Model = types.model({}).actions(() => ({
  forceLoad() {},
}))

test('a plain object is callable; only an MST node has liveness to lose', () => {
  expect(isLiveModel({ forceLoad: () => {} })).toBe(true)

  const node = Model.create({})
  expect(isLiveModel(node)).toBe(true)
})

test('a destroyed node is not callable', () => {
  const parent = types
    .model({ child: types.maybe(Model) })
    .actions(self => ({
      drop() {
        self.child = undefined
      },
    }))
    .create({ child: {} })
  const child = parent.child!

  expect(isLiveModel(child)).toBe(true)
  parent.drop()
  expect(isLiveModel(child)).toBe(false)
})

test('the plain too-large banner force-loads a plain-object model', () => {
  const { TooLarge } = plainChromeOverlays
  const forceLoad = jest.fn()
  render(
    <TooLarge
      model={{
        regionTooLargeReason: 'Requested too much data',
        zoomCanReleaseGate: true,
        forceLoad,
      }}
    />,
  )

  fireEvent.click(screen.getByText('Force load'))
  expect(forceLoad).toHaveBeenCalledTimes(1)
})

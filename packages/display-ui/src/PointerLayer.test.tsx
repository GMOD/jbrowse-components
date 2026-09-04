import { types } from '@jbrowse/mobx-state-tree'
import { act, render } from '@testing-library/react'

import { PointerLayer } from './PointerLayer.tsx'

import type { MouseState } from '@jbrowse/core/ui/useMouseTracking'

// Both halves of the contract at once, because swapping either for the spelling
// the deleted display-kit copy had is silent: a non-observer renders `children`
// untracked, so a display resolving its hit in the callback (sequence's
// `hoverAt`) freezes under a stationary cursor while the pointer half goes on
// working, and a one-argument callback drops `inRows`, which the three displays
// that gate a crosshair on it need to keep it off the band above their rows.

const Model = types.model({ label: types.string }).actions(self => ({
  setLabel(label: string) {
    self.label = label
  },
}))

function createTracker() {
  const subscribers = new Set<() => void>()
  const box: { state: MouseState | undefined } = { state: undefined }
  return {
    subscribe(onStoreChange: () => void) {
      subscribers.add(onStoreChange)
      return () => {
        subscribers.delete(onStoreChange)
      }
    },
    getSnapshot: () => box.state,
    moveTo(y: number) {
      box.state = { x: 3, y, clientX: 3, clientY: y }
      act(() => {
        for (const notify of subscribers) {
          notify()
        }
      })
    },
  }
}

test('children is tracked, and told whether the pointer is over the rows', () => {
  const model = Model.create({ label: 'first' })
  const tracker = createTracker()
  const { getByTestId } = render(
    <PointerLayer mouseTracker={tracker} rowsTopOffset={40}>
      {(state, inRows) => (
        <div data-testid="readout">
          {model.label} {state ? `${state.y} ${inRows}` : 'away'}
        </div>
      )}
    </PointerLayer>,
  )
  const readout = () => getByTestId('readout').textContent

  expect(readout()).toBe('first away')
  tracker.moveTo(39)
  expect(readout()).toBe('first 39 false')
  // the rows begin AT the offset, so the boundary pixel is row 0's top edge
  tracker.moveTo(40)
  expect(readout()).toBe('first 40 true')
  act(() => {
    model.setLabel('second')
  })
  expect(readout()).toBe('second 40 true')
})

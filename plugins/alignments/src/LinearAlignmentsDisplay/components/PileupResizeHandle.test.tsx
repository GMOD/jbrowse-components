import { act, fireEvent, render, screen } from '@testing-library/react'
import { observable, runInAction } from 'mobx'
import { observer } from 'mobx-react'

import { PileupResizeHandle } from './PileupComponent.tsx'

// the seam moves through an observable rather than a `rerender`, whose first
// call remounts and so resets the drag state under test
function setup(initialSeam: number) {
  const seam = observable.box(initialSeam)
  const Handle = observer(function Handle() {
    return (
      <PileupResizeHandle
        seam={seam.get()}
        canvasHeight={100}
        value={50}
        onChange={() => {}}
        title="handle"
      />
    )
  })
  render(<Handle />)
  return {
    moveSeam(next: number) {
      act(() => {
        runInAction(() => {
          seam.set(next)
        })
      })
    },
  }
}

test('a handle off the canvas is not drawn', () => {
  setup(300)
  expect(screen.queryByTitle('handle')).toBeNull()
})

// unmounting the handle mid-drag releases the pointer, which ends the drag
// with no pointerup
test('the handle being dragged stays while its seam leaves the canvas', () => {
  const { moveSeam } = setup(50)
  fireEvent.pointerDown(screen.getByTitle('handle'), {
    clientY: 0,
    pointerId: 1,
  })
  moveSeam(300)
  expect(screen.queryByTitle('handle')).not.toBeNull()

  fireEvent.pointerUp(screen.getByTitle('handle'), {
    clientY: 250,
    pointerId: 1,
  })
  expect(screen.queryByTitle('handle')).toBeNull()
})

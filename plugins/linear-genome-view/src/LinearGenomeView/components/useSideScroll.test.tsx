import { act, fireEvent, render } from '@testing-library/react'

import FloatingLegend from '../../BaseLinearDisplay/components/FloatingLegend.tsx'
import { useSideScroll } from './useSideScroll.ts'

import type { LinearGenomeViewModel } from '../index.ts'

// The hook only ever calls `horizontalScroll`, so the view is that one method.
function fakeView() {
  return { horizontalScroll: jest.fn() } as unknown as LinearGenomeViewModel & {
    horizontalScroll: jest.Mock
  }
}

// TracksContainer in miniature: the pan handler on the container, a canvas
// stand-in, and the legend rendered inside it (FloatingLegend falls back to
// inline rendering with no TrackOverlayContext, which is the same DOM ancestry
// the portal gives it inside a real TrackContainer).
function Harness({ model }: { model: LinearGenomeViewModel }) {
  const { mouseDown, mouseUp } = useSideScroll(model)
  return (
    <div onMouseDown={mouseDown} onMouseUp={mouseUp}>
      <div data-testid="canvas">canvas</div>
      <FloatingLegend items={[{ color: '#f00', label: 'deletion' }]} />
    </div>
  )
}

// press, move, release. The release flushes whatever frame the move queued, so
// the scroll (if any) has landed by the time this returns.
function dragFrom(el: Element) {
  act(() => {
    fireEvent.mouseDown(el, { button: 0, clientX: 100 })
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 60 }))
  })
}

test('a drag on the track pans the view', () => {
  const model = fakeView()
  const { getByTestId } = render(<Harness model={model} />)

  dragFrom(getByTestId('canvas'))

  // dragged 40px left, so the view scrolls 40px right
  expect(model.horizontalScroll.mock.calls).toEqual([[40]])
})

test('a drag on legend text selects it instead of panning', () => {
  const model = fakeView()
  const { getByText } = render(<Harness model={model} />)

  // the press lands on the label, a descendant of the legend box that carries
  // the `data-gesture-owner` marker — hence `closest`, not a check on the target
  dragFrom(getByText('deletion'))

  expect(model.horizontalScroll).not.toHaveBeenCalled()
})

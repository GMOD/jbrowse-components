import { useRef } from 'react'

import { cleanup, fireEvent, render } from '@testing-library/react'

import { useFocusOnInteraction } from './hooks.ts'

afterEach(cleanup)

function Harness({ onInteract }: { onInteract: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusOnInteraction(ref, onInteract)
  return (
    <div>
      <button type="button" data-testid="outside">
        outside
      </button>
      <div ref={ref} data-testid="view" tabIndex={0}>
        <button type="button" data-testid="inside">
          inside
        </button>
      </div>
    </div>
  )
}

// The gap this hook had: a Tab that moves focus INTO the container fires its
// keydown on the element being LEFT, so the two listeners it used to have could
// not see a keyboard arrival at all — the view became focused only on the NEXT
// keystroke, which is the one the user meant as a shortcut.
test('focus arriving in the container assigns it, with no keystroke of its own', () => {
  const onInteract = jest.fn()
  const { getByTestId } = render(<Harness onInteract={onInteract} />)

  // the Tab itself: keydown on the element being left, which is outside
  fireEvent.keyDown(getByTestId('outside'), { key: 'Tab' })
  expect(onInteract).not.toHaveBeenCalled()

  // ...and where that Tab lands
  getByTestId('view').focus()
  expect(onInteract).toHaveBeenCalled()
})

test('focus landing on a descendant counts too', () => {
  const onInteract = jest.fn()
  const { getByTestId } = render(<Harness onInteract={onInteract} />)

  getByTestId('inside').focus()
  expect(onInteract).toHaveBeenCalled()
})

test('focus landing outside the container does not', () => {
  const onInteract = jest.fn()
  const { getByTestId } = render(<Harness onInteract={onInteract} />)

  getByTestId('outside').focus()
  expect(onInteract).not.toHaveBeenCalled()
})

// The mouse path is the one that already worked, and the one a regression here
// would be most visible in.
test('mousedown inside still assigns, and outside still does not', () => {
  const onInteract = jest.fn()
  const { getByTestId } = render(<Harness onInteract={onInteract} />)

  fireEvent.mouseDown(getByTestId('outside'))
  expect(onInteract).not.toHaveBeenCalled()

  fireEvent.mouseDown(getByTestId('inside'))
  expect(onInteract).toHaveBeenCalled()
})

test('the listeners come off on unmount', () => {
  const onInteract = jest.fn()
  const { getByTestId, unmount } = render(<Harness onInteract={onInteract} />)
  const node = getByTestId('view')
  unmount()

  fireEvent.focusIn(node)
  fireEvent.mouseDown(node)
  expect(onInteract).not.toHaveBeenCalled()
})

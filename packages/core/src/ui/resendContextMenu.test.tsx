import { act, fireEvent, render, screen } from '@testing-library/react'

import CascadingMenuButton from './CascadingMenuButton.tsx'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// what the pointer is over besides the open menu, topmost first
let underPointer: string[] = []

function renderMenuOverFeature() {
  const onFeatureContextMenu = jest.fn()
  const onDialogContextMenu = jest.fn()
  const onFeatureMouseMove = jest.fn()
  render(
    <>
      <div
        data-testid="feature"
        onMouseMove={onFeatureMouseMove}
        onContextMenu={event => {
          onFeatureContextMenu(event.clientX, event.clientY)
        }}
      />
      <div className="MuiModal-root">
        <div data-testid="dialog" onContextMenu={onDialogContextMenu} />
      </div>
      <CascadingMenuButton
        tooltip="Track menu"
        menuItems={[{ label: 'Row', onClick: () => {} }]}
      >
        open
      </CascadingMenuButton>
    </>,
  )
  underPointer = ['feature']
  return { onFeatureContextMenu, onFeatureMouseMove, onDialogContextMenu }
}

function menuButton() {
  return screen.getByRole('button', { name: 'Track menu', hidden: true })
}

function rightClickBackdrop() {
  const backdrop = document.querySelector('.MuiBackdrop-root')
  if (!backdrop) {
    throw new Error('no menu is open')
  }
  // jsdom lays nothing out, so the stack under the pointer is given. The menu's
  // backdrop leads it even once the menu has closed, as it does for a menu that
  // stays mounted while it fades
  document.elementsFromPoint = () => [
    backdrop,
    ...underPointer.map(testId => screen.getByTestId(testId)),
  ]
  const notPrevented = fireEvent.contextMenu(backdrop, {
    clientX: 300,
    clientY: 200,
  })
  act(() => {
    jest.runAllTimers()
  })
  return { browserMenuShown: notPrevented }
}

test('a right-click with a menu open closes it and reaches what is underneath', () => {
  const { onFeatureContextMenu, onFeatureMouseMove } = renderMenuOverFeature()
  fireEvent.click(menuButton())
  expect(screen.getByText('Row')).toBeTruthy()

  const { browserMenuShown } = rightClickBackdrop()

  expect(browserMenuShown).toBe(false)
  expect(screen.queryByText('Row')).toBeNull()
  expect(onFeatureMouseMove).toHaveBeenCalledTimes(1)
  expect(onFeatureContextMenu).toHaveBeenCalledWith(300, 200)
})

test('a right-click over the dialog a menu was opened from stays in the dialog', () => {
  const { onFeatureContextMenu, onDialogContextMenu } = renderMenuOverFeature()
  underPointer = ['dialog', 'feature']
  fireEvent.click(menuButton())

  rightClickBackdrop()

  expect(screen.queryByText('Row')).toBeNull()
  expect(onDialogContextMenu).toHaveBeenCalledTimes(1)
  expect(onFeatureContextMenu).not.toHaveBeenCalled()
})

test('the menu button says whether its menu is open', () => {
  renderMenuOverFeature()
  expect(menuButton().getAttribute('aria-haspopup')).toBe('menu')
  expect(menuButton().getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(menuButton())
  expect(menuButton().getAttribute('aria-expanded')).toBe('true')
})

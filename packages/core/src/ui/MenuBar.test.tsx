import { fireEvent, render, screen } from '@testing-library/react'

import MenuBar from './MenuBar.tsx'

const BUTTON_WIDTH = 80

function renderBar(onMenuItemClick?: jest.Mock) {
  const onOpen = jest.fn()
  render(
    <MenuBar
      onMenuItemClick={onMenuItemClick}
      menus={[
        {
          label: 'File',
          menuItems: () => [
            { label: 'Open', onClick: onOpen },
            { label: 'Recent', subMenu: [{ label: 'One', onClick: () => {} }] },
          ],
        },
        { label: 'Add', menuItems: () => [] },
        { label: 'Tools', menuItems: () => [{ label: 'Undo', onClick() {} }] },
        { label: 'Help', menuItems: () => [{ label: 'About', onClick() {} }] },
      ]}
    />,
  )
  // jsdom lays nothing out, so each button gets the rect a real bar gives it
  for (const [index, label] of ['File', 'Add', 'Tools', 'Help'].entries()) {
    barButton(label).getBoundingClientRect = () =>
      DOMRect.fromRect({
        x: index * BUTTON_WIDTH,
        y: 0,
        width: BUTTON_WIDTH,
        height: 48,
      })
  }
  return { onOpen }
}

function barButton(label: string) {
  return screen.getByRole('button', { name: label, hidden: true })
}

function pointAt(label: string) {
  const backdrop = document.querySelector('.MuiBackdrop-root')
  if (!backdrop) {
    throw new Error('no menu is open')
  }
  const { left, top } = barButton(label).getBoundingClientRect()
  fireEvent.mouseMove(backdrop, { clientX: left + 5, clientY: top + 5 })
}

function pressOn(row: string, key: string) {
  fireEvent.keyDown(screen.getByText(row), { key })
}

test('a click opens that menu and a row click runs it', () => {
  const { onOpen } = renderBar()
  fireEvent.click(barButton('File'))
  fireEvent.click(screen.getByText('Open'))
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Open')).toBeNull()
})

test('the caller decides how a row click is invoked', () => {
  const onMenuItemClick = jest.fn()
  const { onOpen } = renderBar(onMenuItemClick)
  fireEvent.click(barButton('File'))
  fireEvent.click(screen.getByText('Open'))
  expect(onMenuItemClick).toHaveBeenCalledWith(onOpen)
  expect(onOpen).not.toHaveBeenCalled()
})

test('a menu with no rows opens nothing', () => {
  renderBar()
  fireEvent.click(barButton('Add'))
  expect(document.querySelector('.MuiBackdrop-root')).toBeNull()
})

test('with a menu open, pointing at another button moves to its menu', () => {
  renderBar()
  fireEvent.click(barButton('File'))
  pointAt('Tools')
  expect(screen.getByText('Undo')).toBeTruthy()
  expect(screen.queryByText('Open')).toBeNull()
})

test('pointing at the button of a menu with no rows keeps the open one', () => {
  renderBar()
  fireEvent.click(barButton('File'))
  pointAt('Add')
  expect(screen.getByText('Open')).toBeTruthy()
})

test('ArrowRight moves to the next menu with rows, and wraps', () => {
  renderBar()
  fireEvent.click(barButton('File'))
  pressOn('Open', 'ArrowRight')
  expect(screen.getByText('Undo')).toBeTruthy()
  pressOn('Undo', 'ArrowRight')
  pressOn('About', 'ArrowRight')
  expect(screen.getByText('Open')).toBeTruthy()
})

test('ArrowLeft moves to the previous menu with rows, and wraps', () => {
  renderBar()
  fireEvent.click(barButton('Tools'))
  pressOn('Undo', 'ArrowLeft')
  expect(screen.getByText('Open')).toBeTruthy()
  pressOn('Open', 'ArrowLeft')
  expect(screen.getByText('About')).toBeTruthy()
})

test('Ctrl+ArrowRight is left to the view behind the menu', () => {
  renderBar()
  fireEvent.click(barButton('File'))
  fireEvent.keyDown(screen.getByText('Open'), {
    key: 'ArrowRight',
    ctrlKey: true,
  })
  expect(screen.getByText('Open')).toBeTruthy()
})

test('ArrowRight on a submenu row opens the submenu, not the next menu', () => {
  renderBar()
  fireEvent.click(barButton('File'))
  pressOn('Recent', 'ArrowRight')
  expect(screen.getByText('One')).toBeTruthy()
  expect(screen.getByText('Open')).toBeTruthy()
  expect(screen.queryByText('Undo')).toBeNull()
})

import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { RowTouchArea } from './RowTouchArea.tsx'

function renderRow() {
  const touches: string[] = []
  render(
    <>
      <RowTouchArea
        className=""
        testId="row"
        onTouch={() => touches.push('row')}
      >
        <button
          type="button"
          onPointerDown={e => {
            e.stopPropagation()
          }}
        >
          inside
        </button>
        {createPortal(<button type="button">menu</button>, document.body)}
      </RowTouchArea>
      <button type="button">elsewhere</button>
    </>,
  )
  return touches
}

test('a press, wheel or key inside the row touches it', () => {
  const touches = renderRow()
  fireEvent.pointerDown(screen.getByText('inside'))
  fireEvent.wheel(screen.getByText('inside'))
  fireEvent.keyDown(screen.getByText('inside'), { key: 'a' })
  expect(touches).toEqual(['row', 'row', 'row'])
})

// the row's own menus and dialogs render in portals outside its DOM
test('a press in a portal the row opened touches it', () => {
  const touches = renderRow()
  fireEvent.pointerDown(screen.getByText('menu'))
  expect(touches).toEqual(['row'])
})

test('a press outside the row does not', () => {
  const touches = renderRow()
  fireEvent.pointerDown(screen.getByText('elsewhere'))
  expect(touches).toEqual([])
})

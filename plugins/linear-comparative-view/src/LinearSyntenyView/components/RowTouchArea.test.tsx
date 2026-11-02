import { fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { RowTouchArea } from './RowTouchArea.tsx'

function renderRow({ scrollZoom = false } = {}) {
  const touches: string[] = []
  render(
    <>
      <RowTouchArea
        className=""
        testId="row"
        scrollZoom={scrollZoom}
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

test('a press, sideways wheel or key inside the row touches it', () => {
  const touches = renderRow()
  fireEvent.pointerDown(screen.getByText('inside'))
  fireEvent.wheel(screen.getByText('inside'), { deltaX: 40, deltaY: 5 })
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

// scrolling the page past a stack would otherwise hand the anchor to every row
// the pointer crossed
test('a wheel the row does not zoom or pan on does not touch it', () => {
  const touches = renderRow()
  fireEvent.wheel(screen.getByText('inside'), { deltaY: 40 })
  fireEvent.wheel(screen.getByText('inside'), { deltaX: 40, deltaY: 40 })
  expect(touches).toEqual([])
})

test('a wheel the row zooms on touches it', () => {
  const touches = renderRow()
  fireEvent.wheel(screen.getByText('inside'), { deltaY: 40, ctrlKey: true })
  expect(touches).toEqual(['row'])
})

test('with scroll-zoom on, a vertical wheel zooms the row and touches it, and shift declines', () => {
  const touches = renderRow({ scrollZoom: true })
  fireEvent.wheel(screen.getByText('inside'), { deltaY: 40 })
  fireEvent.wheel(screen.getByText('inside'), { deltaY: 40, shiftKey: true })
  expect(touches).toEqual(['row'])
})

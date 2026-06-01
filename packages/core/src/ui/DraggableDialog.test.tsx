import { cleanup, fireEvent, render } from '@testing-library/react'

import DraggableDialog from './DraggableDialog.tsx'

afterEach(cleanup)

function getPaper() {
  return document.querySelector<HTMLElement>('.MuiPaper-root')
}

test('renders title and content, paper starts un-translated', () => {
  const { getByText } = render(
    <DraggableDialog open title="My dialog">
      <div>content</div>
    </DraggableDialog>,
  )
  expect(getByText('My dialog')).toBeTruthy()
  expect(getByText('content')).toBeTruthy()
  expect(getPaper()?.style.transform).toBe('translate(0px, 0px)')
})

test('dragging the title translates the paper by the mouse delta', () => {
  const { getByText } = render(
    <DraggableDialog open title="Drag me">
      <div>content</div>
    </DraggableDialog>,
  )
  fireEvent.mouseDown(getByText('Drag me'), { clientX: 10, clientY: 20 })
  fireEvent.mouseMove(window, { clientX: 50, clientY: 60 })
  expect(getPaper()?.style.transform).toBe('translate(40px, 40px)')

  // releasing then moving again should not keep dragging
  fireEvent.mouseUp(window)
  fireEvent.mouseMove(window, { clientX: 200, clientY: 200 })
  expect(getPaper()?.style.transform).toBe('translate(40px, 40px)')
})

test('dragging from the content does not move the paper', () => {
  const { getByText } = render(
    <DraggableDialog open title="Title">
      <div>body</div>
    </DraggableDialog>,
  )
  fireEvent.mouseDown(getByText('body'), { clientX: 10, clientY: 20 })
  fireEvent.mouseMove(window, { clientX: 90, clientY: 90 })
  expect(getPaper()?.style.transform).toBe('translate(0px, 0px)')
})

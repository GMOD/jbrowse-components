import { cleanup, fireEvent, render } from '@testing-library/react'

import DraggableDialog from './DraggableDialog.tsx'

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = () => {}
  HTMLElement.prototype.releasePointerCapture = () => {}
})

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
  expect(getPaper()?.style.transform).toBe('translate(0px)')
})

test('dragging the title translates the paper by the mouse delta', () => {
  const { getByText } = render(
    <DraggableDialog open title="Drag me">
      <div>content</div>
    </DraggableDialog>,
  )
  const title = getByText('Drag me')
  fireEvent.pointerDown(title, {
    clientX: 10,
    clientY: 20,
    pointerId: 1,
    button: 0,
  })
  fireEvent.pointerMove(title, { clientX: 50, clientY: 60, pointerId: 1 })
  expect(getPaper()?.style.transform).toBe('translate(40px, 40px)')

  fireEvent.pointerUp(title, { pointerId: 1 })
  fireEvent.pointerMove(title, { clientX: 200, clientY: 200, pointerId: 1 })
  expect(getPaper()?.style.transform).toBe('translate(40px, 40px)')

  fireEvent.pointerDown(title, {
    clientX: 50,
    clientY: 60,
    pointerId: 1,
    button: 0,
  })
  fireEvent.pointerMove(title, { clientX: 60, clientY: 60, pointerId: 1 })
  expect(getPaper()?.style.transform).toBe('translate(50px, 40px)')
})

test('dragging from the content does not move the paper', () => {
  const { getByText } = render(
    <DraggableDialog open title="Title">
      <div>body</div>
    </DraggableDialog>,
  )
  const body = getByText('body')
  fireEvent.pointerDown(body, {
    clientX: 10,
    clientY: 20,
    pointerId: 1,
    button: 0,
  })
  fireEvent.pointerMove(body, { clientX: 90, clientY: 90, pointerId: 1 })
  expect(getPaper()?.style.transform).toBe('translate(0px)')
})

test('the close button carries the dialog-close testid, calls onClose and does not start a drag', () => {
  const onClose = jest.fn()
  const { getByTestId } = render(
    <DraggableDialog open title="Title" onClose={onClose}>
      <div>body</div>
    </DraggableDialog>,
  )
  const close = getByTestId('dialog-close')
  fireEvent.pointerDown(close, {
    clientX: 10,
    clientY: 20,
    pointerId: 1,
    button: 0,
  })
  fireEvent.pointerMove(close, { clientX: 90, clientY: 90, pointerId: 1 })
  expect(getPaper()?.style.transform).toBe('translate(0px)')
  fireEvent.click(close)
  expect(onClose).toHaveBeenCalledWith(expect.anything(), 'closeButtonClick')
})

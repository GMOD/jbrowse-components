import { cleanup, fireEvent, render } from '@testing-library/react'

import Dialog from './Dialog.tsx'

afterEach(cleanup)

test('renders title prop as heading', () => {
  const { getByText } = render(
    <Dialog open title="Hello dialog">
      <div>content</div>
    </Dialog>,
  )
  expect(getByText('Hello dialog')).toBeTruthy()
  expect(getByText('content')).toBeTruthy()
})

test('titleNode takes precedence over title', () => {
  const { getByText, queryByText } = render(
    <Dialog open title="plain title" titleNode={<span>rich title</span>}>
      <div />
    </Dialog>,
  )
  expect(getByText('rich title')).toBeTruthy()
  expect(queryByText('plain title')).toBeNull()
})

test('custom header replaces default DialogTitle', () => {
  const { getByText, queryByRole } = render(
    <Dialog open header={<div>custom header</div>} onClose={() => {}}>
      <div>body</div>
    </Dialog>,
  )
  expect(getByText('custom header')).toBeTruthy()
  expect(queryByRole('button')).toBeNull()
})

test('custom header is not forwarded as DOM attribute', () => {
  const { baseElement } = render(
    <Dialog open header={<div>custom header</div>}>
      <div />
    </Dialog>,
  )
  const dialog = baseElement.querySelector('[role="dialog"]')
  expect(dialog?.hasAttribute('header')).toBe(false)
})

test('close button renders when onClose is provided', () => {
  const { getByRole } = render(
    <Dialog open title="closeable" onClose={() => {}}>
      <div />
    </Dialog>,
  )
  expect(getByRole('button')).toBeTruthy()
})

test('close button is absent when onClose is not provided', () => {
  const { queryByRole } = render(
    <Dialog open title="no close">
      <div />
    </Dialog>,
  )
  expect(queryByRole('button')).toBeNull()
})

test('close button calls onClose with backdropClick', () => {
  const onClose = jest.fn()
  const { getByRole } = render(
    <Dialog open title="closeable" onClose={onClose}>
      <div />
    </Dialog>,
  )
  fireEvent.click(getByRole('button'))
  expect(onClose).toHaveBeenCalledWith(expect.anything(), 'backdropClick')
})

test('error boundary catches errors thrown by children', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  function Bomb(): never {
    throw new Error('boom')
  }
  const { findByText } = render(
    <Dialog open title="err">
      <Bomb />
    </Dialog>,
  )
  await findByText(/boom/)
  spy.mockRestore()
})

import { fireEvent, render, screen } from '@testing-library/react'
import { observable } from 'mobx'

import { Notifications } from './notifications.tsx'

function fakeSession() {
  const session = observable({
    snackbarMessages: [] as {
      message: string
      level?: string
      actions?: { name: string; onClick: () => void }[]
    }[],
    queueOfDialogs: [] as unknown[],
    popSnackbarMessage() {
      session.snackbarMessages.pop()
    },
    removeActiveDialog() {
      session.queueOfDialogs.shift()
    },
  })
  return session
}

test('nothing queued draws nothing', () => {
  const { container } = render(<Notifications session={fakeSession()} />)
  expect(container.innerHTML).toBe('')
})

test('the latest message is drawn by level, and dismissing shows the one under it', () => {
  const session = fakeSession()
  session.snackbarMessages.push(
    { message: 'saved', level: 'info' },
    { message: 'Could not resolve track x', level: 'error' },
  )
  render(<Notifications session={session} />)
  expect(screen.getByRole('alert').textContent).toContain('Could not resolve')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  expect(screen.getByRole('status').textContent).toContain('saved')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  expect(screen.queryByTestId('embed-notification')).toBeNull()
})

test("a message's actions are buttons, bar the Material stack-trace one", () => {
  const session = fakeSession()
  const retry = jest.fn()
  session.snackbarMessages.push({
    message: 'failed',
    level: 'error',
    actions: [
      { name: 'report', onClick: jest.fn() },
      { name: 'Retry', onClick: retry },
    ],
  })
  render(<Notifications session={session} />)
  expect(screen.queryByRole('button', { name: 'report' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledTimes(1)
})

test('a queued dialog gets a line the reader can dismiss', () => {
  const session = fakeSession()
  session.queueOfDialogs.push([], [])
  render(<Notifications session={session} />)
  expect(screen.getByTestId('queued-dialog-notice').textContent).toContain(
    'JBrowse queued 2 dialogs',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  expect(screen.getByTestId('queued-dialog-notice').textContent).toContain(
    'JBrowse queued 1 dialog,',
  )
})

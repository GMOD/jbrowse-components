import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { NotificationProvider } from './Notifications.tsx'
import { NotifyContext } from './NotifyContext.ts'

import type { NotifyAction } from './NotifyContext.ts'

function Raise({ action }: { action?: NotifyAction }) {
  return (
    <NotifyContext.Consumer>
      {notifyError => (
        <button
          type="button"
          onClick={() => {
            notifyError?.(new Error('boom'), action)
          }}
        >
          raise
        </button>
      )}
    </NotifyContext.Consumer>
  )
}

async function raise(action?: NotifyAction) {
  const user = userEvent.setup()
  render(
    <NotificationProvider>
      <Raise action={action} />
    </NotificationProvider>,
  )
  await user.click(screen.getByText('raise'))
  expect(screen.getByText('Error: boom')).toBeTruthy()
  return user
}

// the Alert always carries an `action`, which suppresses the close button MUI
// would otherwise draw from `onClose` — leaving the Escape key as the only way
// out of an error that never auto-hides
test('a notification can be dismissed by clicking', async () => {
  const user = await raise()
  await user.click(screen.getByTitle('Close'))
  await waitForElementToBeRemoved(() => screen.queryByText('Error: boom'))
})

test('an action button dismisses and runs the action', async () => {
  const onClick = jest.fn()
  const user = await raise({ label: 'Remove', onClick })
  await user.click(screen.getByText('Remove'))
  expect(onClick).toHaveBeenCalled()
  await waitForElementToBeRemoved(() => screen.queryByText('Error: boom'))
})

// MUI keeps a Snackbar's children mounted until the exit transition ends, so a
// message cleared on the click renders as the string "undefined" mid-fade
test('the message survives the fade-out', async () => {
  const user = await raise()
  await user.click(screen.getByTitle('Close'))
  expect(screen.queryByText('undefined')).toBeNull()
})

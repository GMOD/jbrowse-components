import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import DeleteOldSessionsDialog from './DeleteOldSessionsDialog.tsx'

import type { SessionModel } from './util.ts'
import type { SessionMetadata } from '@jbrowse/web-core'

const theme = createJBrowseTheme()

const DAY = 24 * 60 * 60 * 1000

function meta(id: string, daysAgo: number, favorite = false): SessionMetadata {
  return {
    id,
    name: id,
    configPath: '',
    favorite,
    createdAt: new Date(Date.now() - daysAgo * DAY),
    updatedAt: new Date(Date.now() - daysAgo * DAY),
  }
}

function setup(savedSessionMetadata: SessionMetadata[]) {
  const deleteSavedSessions = jest.fn().mockResolvedValue(1)
  const notify = jest.fn()
  const session = {
    id: 'open',
    savedSessionMetadata,
    deleteSavedSessions,
    notify,
    notifyError: jest.fn(),
  } as unknown as SessionModel
  const onClose = jest.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <DeleteOldSessionsDialog session={session} onClose={onClose} />
    </ThemeProvider>,
  )
  return { ...utils, deleteSavedSessions, notify, onClose }
}

// the old control was a single unconfirmed click that deleted an unstated
// number of sessions; the count is the thing that makes it safe to press
test('states how many sessions the cutoff matches', () => {
  const { getByText } = setup([
    meta('yesterday', 2),
    meta('lastYear', 400),
    meta('today', 0),
  ])
  expect(getByText(/2 sessions will be deleted/)).toBeTruthy()
})

test('deletes exactly the matched sessions, in one call', () => {
  const { getByText, deleteSavedSessions, onClose } = setup([
    meta('yesterday', 2),
    meta('today', 0),
  ])

  fireEvent.click(getByText('Delete'))

  expect(deleteSavedSessions).toHaveBeenCalledTimes(1)
  expect(deleteSavedSessions).toHaveBeenCalledWith(['yesterday'])
  expect(onClose).toHaveBeenCalled()
})

// favorites are what the user asked to keep, and the open session cannot be
// deleted at all — so neither may be counted or sent
test('never offers a favorite or the open session', () => {
  const { getByText, deleteSavedSessions } = setup([
    meta('starred', 400, true),
    meta('open', 400),
    meta('plain', 400),
  ])
  expect(getByText(/1 session will be deleted/)).toBeTruthy()

  fireEvent.click(getByText('Delete'))

  expect(deleteSavedSessions).toHaveBeenCalledWith(['plain'])
})

test('reports success only for what was deleted', async () => {
  const { getByText, deleteSavedSessions, notify } = setup([meta('plain', 400)])
  deleteSavedSessions.mockResolvedValueOnce(0)

  fireEvent.click(getByText('Delete'))
  await deleteSavedSessions.mock.results[0]!.value

  expect(notify).not.toHaveBeenCalled()
})

test('cannot be submitted when nothing matches', () => {
  const { getByText } = setup([meta('today', 0)])
  expect(getByText(/No sessions match/)).toBeTruthy()
  expect(getByText('Delete').closest('button')!.disabled).toBe(true)
})

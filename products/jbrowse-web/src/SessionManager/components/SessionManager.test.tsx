import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import SessionManager from './SessionManager.tsx'

import type { SessionModel } from './util.ts'
import type { SessionMetadata } from '@jbrowse/app-core'

const theme = createJBrowseTheme()

function meta(id: string): SessionMetadata {
  return {
    id,
    name: id,
    configPath: '',
    favorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function setup(savedSessionMetadata: SessionMetadata[] | undefined) {
  const session = {
    id: 'open',
    savedSessionMetadata,
    activateSession: jest.fn(),
    deleteSavedSession: jest.fn(),
    deleteSavedSessions: jest.fn(),
    setSavedSessionFavorite: jest.fn(),
    renameSavedSession: jest.fn(),
    notify: jest.fn(),
    notifyError: jest.fn(),
  } as unknown as SessionModel
  const result = render(
    <ThemeProvider theme={theme}>
      <SessionManager session={session} />
    </ThemeProvider>,
  )
  return { ...result, session }
}

// undefined means the saved-session database is still opening. It used to read
// "No sessions loaded", which is the same words an empty database deserves.
test('says it is loading while the database has not opened', () => {
  const { getByText, queryByTestId } = setup(undefined)
  expect(getByText(/Loading saved sessions/)).toBeTruthy()
  expect(queryByTestId('session-manager-table')).toBeNull()
})

test('shows the table once the list has loaded, empty or not', () => {
  const { getByTestId, getByText, queryByText } = setup([])
  expect(queryByText(/Loading saved sessions/)).toBeNull()
  expect(getByTestId('session-manager-table')).toBeTruthy()
  expect(getByText('No saved sessions')).toBeTruthy()
})

// re-opening the current session from IndexedDB can only lose work, so it is
// not a link; and deleting its row only makes it vanish until the next autosave
// tick puts it back, so the button says so instead of a post-click snackbar
test('the open session is neither activatable nor deletable', () => {
  const { getByText, getAllByRole } = setup([meta('open'), meta('other')])

  expect(getByText('open (current)')).toBeTruthy()
  expect(getByText('other').closest('a')).toBeTruthy()

  const deletes = getAllByRole('button', { name: /Delete session other/ })
  const blocked = getAllByRole('button', {
    name: /Cannot delete the session that is currently open/,
  })
  expect(deletes).toHaveLength(1)
  expect(blocked).toHaveLength(1)
  expect((blocked[0] as HTMLButtonElement).disabled).toBe(true)
})

test('a double click on a name renames the session, trimmed', () => {
  const { session } = setup([meta('open'), meta('other')])
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Rename other' }))
  const input = screen.getByRole('textbox', { name: 'Rename other' })
  fireEvent.change(input, { target: { value: '  renamed  ' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(session.renameSavedSession).toHaveBeenCalledWith('other', 'renamed')
})

test('a blank or padded-but-unchanged name renames nothing', () => {
  const { session } = setup([meta('other')])
  for (const value of ['   ', ' other ']) {
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Rename other' }))
    const input = screen.getByRole('textbox', { name: 'Rename other' })
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)
  }
  expect(session.renameSavedSession).not.toHaveBeenCalled()
})

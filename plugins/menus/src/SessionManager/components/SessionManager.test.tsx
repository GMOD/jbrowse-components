import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SessionManager from './SessionManager.tsx'

import type { SessionMetadata, SessionModel } from './util.ts'

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
  return render(
    <ThemeProvider theme={theme}>
      <SessionManager session={session} />
    </ThemeProvider>,
  )
}

// undefined means the saved-session database is still opening. It used to read
// "No sessions loaded", which is the same words an empty database deserves.
test('says it is loading while the database has not opened', () => {
  const { getByText, container } = setup(undefined)
  expect(getByText(/Loading saved sessions/)).toBeTruthy()
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(0)
})

test('shows the grid once the list has loaded, empty or not', () => {
  const { container, queryByText } = setup([])
  expect(queryByText(/Loading saved sessions/)).toBeNull()
  expect(container.querySelectorAll('.MuiDataGrid-root')).toHaveLength(1)
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

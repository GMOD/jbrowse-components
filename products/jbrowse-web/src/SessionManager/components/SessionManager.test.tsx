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

test("a saved session's picture shows beside it, and one without gets a blank box", () => {
  const picture = 'data:image/webp;base64,UklGRg=='
  const { getByTestId } = setup([
    { ...meta('pictured'), thumbnail: picture },
    meta('plain'),
  ])
  const images = getByTestId('session-manager-table').querySelectorAll('img')
  expect([...images].map(img => img.getAttribute('src'))).toEqual([picture])
  expect(screen.getByRole('columnheader', { name: 'Thumbnail' })).toBeTruthy()
})

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

function rename(name: string, value: string) {
  fireEvent.click(
    screen.getByRole('button', { name: `Rename session ${name}` }),
  )
  const input = screen.getByRole('textbox', { name: `Rename ${name}` })
  fireEvent.change(input, { target: { value } })
  return input
}

test('the rename button renames the session, trimmed', () => {
  const { session } = setup([meta('open'), meta('other')])
  fireEvent.keyDown(rename('other', '  renamed  '), { key: 'Enter' })
  expect(session.renameSavedSession).toHaveBeenCalledWith('other', 'renamed')
  expect(screen.queryByRole('textbox', { name: 'Rename other' })).toBeNull()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Rename session other' }),
  )
})

test('a click on the name switches sessions rather than renaming', () => {
  const { session } = setup([meta('open'), meta('other')])
  fireEvent.click(screen.getByText('other'))
  expect(session.activateSession).toHaveBeenCalledWith('other')
  expect(screen.queryByRole('textbox', { name: 'Rename other' })).toBeNull()
})

test('a blank or padded-but-unchanged name renames nothing', () => {
  const { session } = setup([meta('other')])
  for (const value of ['   ', ' other ']) {
    fireEvent.blur(rename('other', value))
  }
  expect(session.renameSavedSession).not.toHaveBeenCalled()
})

test('the search narrows the list by name and says how many are left', () => {
  setup([meta('open'), meta('other'), meta('another')])
  expect(screen.queryByRole('status')).toBeNull()
  const search = screen.getByRole('textbox', { name: 'Search' })
  fireEvent.change(search, { target: { value: 'OTHER' } })
  expect(screen.queryByText('open (current)')).toBeNull()
  expect(screen.getByText('other')).toBeTruthy()
  expect(screen.getByText('another')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('2 of 3')
})

test('the search reads the summary line under the name', () => {
  setup([
    { ...meta('work'), summary: { assemblies: ['hg38'], views: 2, tracks: 0 } },
    { ...meta('home'), summary: { assemblies: ['mm39'], views: 1, tracks: 0 } },
  ])
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: 'hg38' },
  })
  expect(screen.getByText('work')).toBeTruthy()
  expect(screen.queryByText('home')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('1 of 2')
})

test('the search reads the name, not the "(current)" the label adds', () => {
  setup([meta('open'), meta('other')])
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
    target: { value: 'current' },
  })
  expect(screen.getByText('No matching sessions')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('0 of 2')
})

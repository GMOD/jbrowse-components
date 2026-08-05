import { render, screen } from '@testing-library/react'

import DeleteSessionDialog from './DeleteSessionDialog.tsx'

import type { RecentSessionData } from '../types.ts'

jest.mock('../../../ipc.ts', () => ({ invokeIpc: jest.fn() }))

function session(over: Partial<RecentSessionData>): RecentSessionData {
  return {
    path: '/autosaved/1.json',
    name: 'a session',
    updated: 1,
    isAutosave: true,
    ...over,
  }
}

// The dialog is the only thing between a click and an unrecoverable delete, so
// what it says is the feature: "Delete" under a list called "Recently opened
// sessions" reads as "remove from this list", and this removes the file.
test('names the file of a session the user saved somewhere', () => {
  render(
    <DeleteSessionDialog
      sessionsToDelete={[
        session({
          path: '/home/u/Documents/JBrowse/mine.jbrowse',
          isAutosave: false,
        }),
      ]}
      onClose={() => {}}
    />,
  )

  expect(screen.getByText(/deletes the session file itself/)).toBeTruthy()
  expect(
    screen.getByText('/home/u/Documents/JBrowse/mine.jbrowse'),
  ).toBeTruthy()
})

test('says as much for autosaves without listing paths nobody chose', () => {
  render(
    <DeleteSessionDialog
      sessionsToDelete={[session({}), session({ path: '/autosaved/2.json' })]}
      onClose={() => {}}
    />,
  )

  expect(screen.getByText(/deletes the autosave files themselves/)).toBeTruthy()
  expect(screen.queryByText('/autosaved/1.json')).toBeNull()
})

test('caps the list rather than filling the dialog with paths', () => {
  render(
    <DeleteSessionDialog
      sessionsToDelete={Array.from({ length: 12 }, (_, i) =>
        session({ path: `/home/u/s${i}.jbrowse`, isAutosave: false }),
      )}
      onClose={() => {}}
    />,
  )

  expect(screen.getByText('/home/u/s0.jbrowse')).toBeTruthy()
  expect(screen.queryByText('/home/u/s11.jbrowse')).toBeNull()
  expect(screen.getByText(/and 4 more/)).toBeTruthy()
})

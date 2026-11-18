import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ImportSessionWidget from './ImportSessionWidget.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

afterEach(() => {
  jest.restoreAllMocks()
})

function chooseFile(
  session: ReturnType<typeof createTestSession>,
  contents: unknown,
) {
  const widget = session.addWidget('ImportSessionWidget', 'importSessionWidget')
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ImportSessionWidget model={widget} />
    </ThemeProvider>,
  )
  const input = container.querySelector('input[type="file"]')
  if (!input) {
    throw new Error('the widget has no file input')
  }
  fireEvent.change(input, {
    target: {
      files: [new File([JSON.stringify(contents)], 'session.json')],
    },
  })
}

test('on a session that saves before it switches, the import goes through openSessionCopy', async () => {
  const session = createTestSession()
  const openSessionCopy = jest
    .spyOn(session, 'openSessionCopy')
    .mockResolvedValue(undefined)
  const setSession = jest.spyOn(session, 'setSession')
  chooseFile(session, { session: { id: 'old', name: 'Imported' } })
  await waitFor(() => {
    expect(openSessionCopy).toHaveBeenCalledWith({ name: 'Imported' })
  })
  expect(setSession).not.toHaveBeenCalled()
})

test('a session file with no name is refused with a readable message', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const session = createTestSession()
  chooseFile(session, { session: { views: [] } })
  expect(await screen.findByText(/needs a "name"/)).toBeTruthy()
  expect(getEnv(session).pluginManager.rootModel?.session).toBe(session)
})

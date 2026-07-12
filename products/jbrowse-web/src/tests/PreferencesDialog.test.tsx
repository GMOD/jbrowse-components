import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { PreferencesDialog } from '@jbrowse/product-core'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { createTestSession } from '../rootModel/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('../makeWorkerInstance', () => () => {})

function renderPrefs() {
  localStorage.clear()
  const session = createTestSession()
  const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(session)
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PreferencesDialog
        handleClose={() => {}}
        session={session}
        pluginManager={pluginManager}
      />
    </ThemeProvider>,
  )
  return { session, ...utils }
}

test('reset confirmation lists the active differences then clears them', () => {
  const { session, getByRole, getByText } = renderPrefs()
  session.setScrollZoom(true)
  session.setStickyViewHeaders(false)

  fireEvent.click(getByRole('button', { name: 'Reset to defaults…' }))

  // the confirmation surfaces the exact diff across subsystems (preference-map
  // override + layout flag), not a blind reset
  expect(getByText('scrollZoom')).toBeTruthy()
  expect(getByText('stickyViewHeaders')).toBeTruthy()

  fireEvent.click(getByRole('button', { name: /^Reset to defaults$/ }))

  expect(session.getPreferenceChanges()).toEqual([])
  expect(session.scrollZoom).toBe(false)
  expect(session.stickyViewHeaders).toBe(true)
})

test('canceling the confirmation leaves preferences untouched', () => {
  const { session, getByRole } = renderPrefs()
  session.setScrollZoom(true)

  fireEvent.click(getByRole('button', { name: 'Reset to defaults…' }))
  fireEvent.click(getByRole('button', { name: 'Cancel' }))

  expect(session.scrollZoom).toBe(true)
})

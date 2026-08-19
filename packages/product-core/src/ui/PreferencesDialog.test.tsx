import PluginManager from '@jbrowse/core/PluginManager'
import { createJBrowseTheme, defaultThemes } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import PreferencesDialog from './PreferencesDialog.tsx'

import type { PreferencesDialogSession } from './PreferencesDialog.tsx'
import type { TrackConfigChange } from '@jbrowse/core/util'

const pluginManager = new PluginManager([])
  .createPluggableElements()
  .configure()

function stubSession(
  overrides: Partial<PreferencesDialogSession> = {},
): PreferencesDialogSession {
  return {
    allThemes: () => defaultThemes,
    themeName: 'default',
    setThemeName: jest.fn(),
    stickyViewHeaders: true,
    setStickyViewHeaders: jest.fn(),
    effectiveUseWorkspaces: false,
    defaultUseWorkspaces: false,
    setUseWorkspacesPreference: jest.fn(),
    resetUseWorkspaces: jest.fn(),
    animationMode: 'enabled',
    numberGrouping: true,
    scrollZoom: false,
    setScrollZoom: jest.fn(),
    setPreferenceOverride: jest.fn(),
    clearPreferenceOverrides: jest.fn(),
    getPreferenceChanges: (): TrackConfigChange[] => [],
    resetPreferenceChange: jest.fn(),
    getDisplayTypeDefaults: () => [],
    setDisplayTypeDefault: jest.fn(),
    ...overrides,
  }
}

function openResetDialog(session: PreferencesDialogSession) {
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PreferencesDialog
        session={session}
        pluginManager={pluginManager}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
  fireEvent.click(utils.getByRole('button', { name: 'Reset to defaults…' }))
  return utils
}

// A spec `layout` (or "move view to a tab") turns workspaces on for the session
// alone, writing no preference override — so the override map has nothing to
// report even though `resetUseWorkspaces` would visibly turn it back off. The
// diff has to state the resolved flag, or the confirmation comes up empty with
// its Reset button disabled and the user has no way back to the admin default.
test('reset diff reports session-scoped workspaces, which writes no override', () => {
  const session = stubSession({
    effectiveUseWorkspaces: true,
    defaultUseWorkspaces: false,
  })
  const { getByText, getByRole } = openResetDialog(session)

  expect(getByText('useWorkspaces')).toBeTruthy()
  const reset = getByRole('button', { name: 'Reset to defaults' })
  expect(reset.hasAttribute('disabled')).toBe(false)

  fireEvent.click(reset)
  expect(session.resetUseWorkspaces).toHaveBeenCalledTimes(1)
})

// The override map also carries a `useWorkspaces` row once the user toggles the
// checkbox. Only the subsystem's row survives: two rows with the same path
// collide as React keys, and they disagree whenever the session value and the
// override differ.
test('workspaces is reported once when an override exists too', () => {
  const session = stubSession({
    effectiveUseWorkspaces: true,
    defaultUseWorkspaces: false,
    getPreferenceChanges: () => [
      { path: ['useWorkspaces'], from: false, to: true },
      { path: ['scrollZoom'], from: false, to: true },
    ],
  })
  const { getAllByText, getByText } = openResetDialog(session)

  expect(getAllByText('useWorkspaces')).toHaveLength(1)
  expect(getByText('scrollZoom')).toBeTruthy()
})

test('nothing to reset when every preference is at its default', () => {
  const { getByText, getByRole } = openResetDialog(stubSession())

  expect(
    getByText('All preferences are already at their defaults.'),
  ).toBeTruthy()
  expect(
    getByRole('button', { name: 'Reset to defaults' }).hasAttribute('disabled'),
  ).toBe(true)
})

// The dialog resets scroll-to-zoom (it is an override like any other) and used
// to offer no way to set it, so the one place a user goes to undo a persistent
// global preference was the one place that didn't have it.
//
// Through `setScrollZoom` rather than the override map directly: that setter
// also stops offering the scroll-to-zoom prompt, and someone toggling it here
// has plainly found the preference the prompt exists to point at.
test('scroll-to-zoom is settable here, through the session setter', () => {
  const setScrollZoom = jest.fn()
  const setPreferenceOverride = jest.fn()
  const session = stubSession({ setScrollZoom, setPreferenceOverride })
  const { getByRole } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PreferencesDialog
        session={session}
        pluginManager={pluginManager}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )

  fireEvent.click(getByRole('checkbox', { name: /Zoom on scroll/ }))

  expect(setScrollZoom).toHaveBeenCalledWith(true)
  expect(setPreferenceOverride).not.toHaveBeenCalled()
})

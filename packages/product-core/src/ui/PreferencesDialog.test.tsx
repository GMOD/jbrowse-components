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
    themeMode: 'light' as const,
    setThemeMode: jest.fn(),
    stickyViewHeaders: true,
    setStickyViewHeaders: jest.fn(),
    animationMode: 'enabled',
    numberGrouping: true,
    scrollZoom: false,
    setScrollZoom: jest.fn(),
    setPreferenceOverride: jest.fn(),
    clearPreferenceOverrides: jest.fn(),
    getPreferenceChanges: (): TrackConfigChange[] => [],
    clearPreferenceOverride: jest.fn(),
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

// A preference held outside the override map can have a row there too; only
// the subsystem's row survives, since two rows with one path collide as React
// keys and disagree whenever the two values differ.
test('a preference held outside the map is reported once', () => {
  const session = stubSession({
    stickyViewHeaders: false,
    getPreferenceChanges: () => [
      { path: ['stickyViewHeaders'], from: true, to: false },
      { path: ['scrollZoom'], from: false, to: true },
    ],
  })
  const { getAllByText, getByText } = openResetDialog(session)

  expect(getAllByText('stickyViewHeaders')).toHaveLength(1)
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

  fireEvent.click(getByRole('tab', { name: 'Views' }))
  fireEvent.click(getByRole('checkbox', { name: /Zoom on scroll/ }))

  expect(setScrollZoom).toHaveBeenCalledWith(true)
  expect(setPreferenceOverride).not.toHaveBeenCalled()
})

test('a plugin panel is its own tab', () => {
  const pm = new PluginManager([]).createPluggableElements().configure()
  pm.contributeToExtensionPoint('Core-preferencesDialogPanels', () => [
    { name: 'My plugin', Component: () => <div>plugin settings</div> },
  ])
  const { getByRole, getByText, queryByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <PreferencesDialog
        session={stubSession()}
        pluginManager={pm}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )

  expect(queryByText('plugin settings')).toBeNull()
  fireEvent.click(getByRole('tab', { name: 'My plugin' }))
  expect(getByText('plugin settings')).toBeTruthy()
})

import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ThemeModeButton from './ThemeModeButton.tsx'

afterEach(cleanup)

const theme = createJBrowseTheme()

const Mode = types.enumeration<'light' | 'dark'>(['light', 'dark'])

// The control's own contract: when it is there at all, what it names, and what
// a click holds. How the real session resolves these is pinned in
// product-core's Themes.test.ts.
const Session = types
  .model({
    themeMode: types.optional(
      types.enumeration<'light' | 'dark' | 'system'>([
        'light',
        'dark',
        'system',
      ]),
      'system',
    ),
    systemMode: types.optional(Mode, 'light'),
    systemThemeOverride: types.maybe(Mode),
    pinnedDark: false,
    darkReaderDark: false,
  })
  .views(self => ({
    get effectiveThemeMode() {
      if (self.darkReaderDark) {
        return 'dark'
      }
      return self.themeMode === 'system'
        ? (self.systemThemeOverride ?? self.systemMode)
        : self.themeMode
    },
    get themeIsDark() {
      return self.pinnedDark || this.effectiveThemeMode === 'dark'
    },
  }))
  .actions(self => ({
    setSystemThemeOverride(mode?: 'light' | 'dark') {
      self.systemThemeOverride = mode
    },
  }))

function renderButton(snap: {
  themeMode?: 'light' | 'dark' | 'system'
  systemMode?: 'light' | 'dark'
  pinnedDark?: boolean
  darkReaderDark?: boolean
}) {
  const session = Session.create(snap)
  const utils = render(
    <ThemeProvider theme={theme}>
      <ThemeModeButton session={session} />
    </ThemeProvider>,
  )
  return { ...utils, session }
}

// The point of the gating: a session on an explicit mode is never shown a
// route into dark it did not ask for.
test('an explicit mode gets no control', () => {
  const { queryByTestId } = renderButton({ themeMode: 'light' })

  expect(queryByTestId('theme-mode-button')).toBeNull()
})

test('following the system names the mode it landed in', () => {
  const { getByTestId } = renderButton({ systemMode: 'dark' })

  expect(getByTestId('theme-mode-button').getAttribute('aria-label')).toBe(
    'Following your system theme (dark)',
  )
})

test('a click holds the other mode and the control stays for the way back', () => {
  const { getByTestId, session } = renderButton({ systemMode: 'dark' })

  fireEvent.click(getByTestId('theme-mode-button'))
  expect(session.themeMode).toBe('system')
  expect(session.themeIsDark).toBe(false)
  expect(getByTestId('theme-mode-button').getAttribute('aria-label')).toBe(
    'Light until your system theme changes',
  )

  fireEvent.click(getByTestId('theme-mode-button'))
  expect(session.systemThemeOverride).toBeUndefined()
  expect(getByTestId('theme-mode-button').getAttribute('aria-label')).toBe(
    'Following your system theme (dark)',
  )
})

// A palette pinned to `mode: 'dark'` draws dark whatever the OS asks, so there
// is no following to report and nothing a click could change.
test('a palette pinned to its own mode gets no control', () => {
  const { queryByTestId } = renderButton({ pinnedDark: true })

  expect(queryByTestId('theme-mode-button')).toBeNull()
})

// Dark Reader draws the page dark over a light OS, and a held light mode would
// stay dark under it, so the control would name a mode it cannot leave.
test('a page Dark Reader has darkened gets no control', () => {
  const { queryByTestId } = renderButton({ darkReaderDark: true })

  expect(queryByTestId('theme-mode-button')).toBeNull()
})

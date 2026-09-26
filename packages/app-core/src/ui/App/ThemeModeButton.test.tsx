import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ThemeModeButton from './ThemeModeButton.tsx'

afterEach(cleanup)

const theme = createJBrowseTheme()

// The control's own contract: when it is there at all, what it names, and that
// a click leaves the following. What each theme name resolves to is pinned in
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
    themeIsDark: false,
  })
  .actions(self => ({
    stopFollowingSystemTheme() {
      self.themeMode = self.themeIsDark ? 'light' : 'dark'
    },
  }))

function renderButton(snap: {
  themeMode?: 'light' | 'dark' | 'system'
  themeIsDark?: boolean
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
  const { getByTestId } = renderButton({ themeIsDark: true })

  expect(getByTestId('theme-mode-button').getAttribute('aria-label')).toBe(
    'Following your system theme (dark)',
  )
})

test('a click leaves the following, taking the control with it', () => {
  const { getByTestId, queryByTestId, session } = renderButton({
    themeIsDark: true,
  })

  fireEvent.click(getByTestId('theme-mode-button'))

  expect(session.themeMode).toBe('light')
  expect(queryByTestId('theme-mode-button')).toBeNull()
})

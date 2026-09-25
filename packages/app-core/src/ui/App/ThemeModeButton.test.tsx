import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ThemeModeButton from './ThemeModeButton.tsx'

afterEach(cleanup)

const theme = createJBrowseTheme()

// The control's own contract, against the three stops rather than the session:
// which icon it shows, and that a click advances. What each stop resolves to is
// pinned in product-core's Themes.test.ts.
const Session = types
  .model({ selectedThemeName: 'system', themeIsDark: false })
  .actions(self => ({
    cycleThemeMode() {
      self.selectedThemeName =
        self.selectedThemeName === 'system'
          ? 'default'
          : self.themeIsDark
            ? 'system'
            : 'darkStock'
      self.themeIsDark = self.selectedThemeName === 'darkStock'
    },
  }))

function renderButton() {
  const session = Session.create()
  const utils = render(
    <ThemeProvider theme={theme}>
      <ThemeModeButton session={session} />
    </ThemeProvider>,
  )
  return { ...utils, session }
}

test('the button names its stop and advances through all three', () => {
  const { getByTestId } = renderButton()
  const button = getByTestId('theme-mode-button')

  expect(button.getAttribute('aria-label')).toBe(
    'Theme: following the system (light)',
  )

  fireEvent.click(button)
  expect(button.getAttribute('aria-label')).toBe('Theme: light')

  fireEvent.click(button)
  expect(button.getAttribute('aria-label')).toBe('Theme: dark')

  fireEvent.click(button)
  expect(button.getAttribute('aria-label')).toBe(
    'Theme: following the system (light)',
  )
})

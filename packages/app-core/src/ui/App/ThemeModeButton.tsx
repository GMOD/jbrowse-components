import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeSwitchSession } from './types.ts'

/**
 * Which way the OS has pointed a session that follows it, and one click out.
 * A session on an explicit light or dark gets nothing, which is every session
 * that has not asked for this in Preferences, leaving the toolbar to say where
 * a dark page came from and to offer a light one no route into dark.
 */
const ThemeModeButton = observer(function ThemeModeButton({
  session,
}: {
  session: ThemeSwitchSession
}) {
  const dark = session.themeIsDark
  // A palette pinned to its own mode draws dark whatever the OS says, so the
  // two disagree and the system is steering nothing to report. Everything else
  // that hides this control is `themeMode`.
  const followsSystem =
    session.themeMode === 'system' &&
    dark === (session.effectiveThemeMode === 'dark')
  if (!followsSystem) {
    return null
  }
  const Icon = dark ? DarkModeIcon : LightModeIcon
  const label = `Following your system theme (${dark ? 'dark' : 'light'})`
  return (
    <Tooltip title={`${label}. Click for ${dark ? 'light' : 'dark'}.`} arrow>
      <IconButton
        data-testid="theme-mode-button"
        aria-label={label}
        color="inherit"
        size="small"
        onClick={() => {
          session.stopFollowingSystemTheme()
        }}
      >
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
})

export default ThemeModeButton

import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeSwitchSession } from './types.ts'

/**
 * A light/dark switch for a session that follows the OS, showing the mode
 * drawn. A click holds the other mode, a second click follows the OS again. A
 * session on an explicit light or dark gets nothing, which is every session
 * that has not asked for this in Preferences, so a light reader is offered no
 * route into dark.
 */
const ThemeModeButton = observer(function ThemeModeButton({
  session,
}: {
  session: ThemeSwitchSession
}) {
  const dark = session.themeIsDark
  const drawnMode = dark ? 'dark' : 'light'
  // A palette pinned to its own mode, or Dark Reader, draws dark whatever the
  // OS says, so a click here would change nothing.
  const followsSystem =
    session.themeMode === 'system' &&
    !session.darkReaderDark &&
    drawnMode === session.effectiveThemeMode
  if (!followsSystem) {
    return null
  }
  const held = session.systemThemeOverride
  const otherMode = dark ? 'light' : 'dark'
  const Icon = dark ? DarkModeIcon : LightModeIcon
  const label = held
    ? `${dark ? 'Dark' : 'Light'} until your system theme changes`
    : `Following your system theme (${drawnMode})`
  const action = held ? `to follow it (${otherMode})` : `for ${otherMode}`
  return (
    <Tooltip title={`${label}. Click ${action}.`} arrow>
      <IconButton
        data-testid="theme-mode-button"
        aria-label={label}
        color="inherit"
        size="small"
        onClick={() => {
          session.setSystemThemeOverride(held ? undefined : otherMode)
        }}
      >
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
})

export default ThemeModeButton

import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeSwitchSession } from './types.ts'

/**
 * A light/dark switch for a session that follows the OS or sits on dark,
 * showing the mode drawn. A click holds the other mode, a second click returns
 * to the setting. A session on an explicit light gets nothing, so a reader who
 * never asked for dark is offered no route into it.
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
  const switchable =
    session.themeMode !== 'light' &&
    !session.darkReaderDark &&
    drawnMode === session.effectiveThemeMode
  if (!switchable) {
    return null
  }
  const held = session.systemThemeOverride
  const otherMode = dark ? 'light' : 'dark'
  const Icon = dark ? DarkModeIcon : LightModeIcon
  const system = session.themeMode === 'system'
  const modeName = dark ? 'Dark' : 'Light'
  const label = system
    ? held
      ? `${modeName} until your system theme changes`
      : `Following your system theme (${drawnMode})`
    : held
      ? `${modeName} instead of your dark setting`
      : modeName
  const action = held
    ? `to ${system ? 'follow it' : 'return'} (${otherMode})`
    : `for ${otherMode}`
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

import { SYSTEM_THEME } from '@jbrowse/product-core'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeSwitchSession } from './types.ts'

/**
 * Which way the OS has pointed a session that follows it, and one click out.
 * Nothing at all for a session on a named theme, which is every session that
 * has not asked for this in Preferences: the toolbar says where a dark page
 * came from, and it never offers a light one a route into dark.
 */
const ThemeModeButton = observer(function ThemeModeButton({
  session,
}: {
  session: ThemeSwitchSession
}) {
  if (session.selectedThemeName !== SYSTEM_THEME) {
    return null
  }
  const dark = session.themeIsDark
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

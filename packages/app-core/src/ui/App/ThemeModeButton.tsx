import { SYSTEM_THEME } from '@jbrowse/product-core'
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { ThemeSwitchSession } from './types.ts'

function describe(session: ThemeSwitchSession) {
  const mode = session.themeIsDark ? 'dark' : 'light'
  return session.selectedThemeName === SYSTEM_THEME
    ? {
        Icon: BrightnessAutoIcon,
        label: `Theme: following the system (${mode})`,
      }
    : {
        Icon: session.themeIsDark ? DarkModeIcon : LightModeIcon,
        label: `Theme: ${mode}`,
      }
}

/**
 * One click through the light/dark axis: following the system, then light, then
 * dark, then back. The icon is the stop it is on, so a reader can tell whether
 * the dark page in front of them is a choice or the hour of the day. The rest
 * of the themes stay in Preferences, which this writes the same field as.
 */
const ThemeModeButton = observer(function ThemeModeButton({
  session,
}: {
  session: ThemeSwitchSession
}) {
  const { Icon, label } = describe(session)
  return (
    <Tooltip title={`${label}. Click to change.`} arrow>
      <IconButton
        data-testid="theme-mode-button"
        aria-label={label}
        color="inherit"
        size="small"
        onClick={() => {
          session.cycleThemeMode()
        }}
      >
        <Icon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
})

export default ThemeModeButton

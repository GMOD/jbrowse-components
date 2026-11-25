import { DNA } from '@jbrowse/core/ui/Icons'
import BugReportIcon from '@mui/icons-material/BugReport'
import ExtensionIcon from '@mui/icons-material/Extension'
import ExtensionOffIcon from '@mui/icons-material/ExtensionOff'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import RefreshIcon from '@mui/icons-material/Refresh'
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'

import {
  desktopHelpMenuItems,
  exitMenuItem,
  openConfigFileMenuItem,
  openLinkMenuItem,
} from '../../desktopMenuItems.ts'
import { reloadInSafeMode, reloadWithGlobalPlugins } from './globalPlugins.ts'

import type { StartScreenDialog } from './startScreenLaunch.ts'
import type { Menu } from '@jbrowse/app-core'
import type { MenuItem } from '@jbrowse/core/ui'

export function startScreenMenus({
  loading,
  safeMode,
  openDialog,
  openConfigFile,
  pluginMenuItems,
  onError,
}: {
  loading: boolean
  safeMode: boolean
  openDialog: (dialog: StartScreenDialog) => void
  openConfigFile: (path: string) => Promise<void>
  pluginMenuItems: () => MenuItem[]
  onError: (e: unknown) => void
}) {
  return [
    {
      label: 'File',
      menuItems: () => [
        {
          label: 'Open your own genome...',
          icon: DNA,
          disabled: loading,
          onClick: () => {
            openDialog({ type: 'openGenome' })
          },
        },
        {
          label: 'Browse hosted genomes...',
          icon: TravelExploreIcon,
          disabled: loading,
          onClick: () => {
            openDialog({ type: 'hostedGenomes' })
          },
        },
        {
          ...openConfigFileMenuItem(openConfigFile, onError),
          disabled: loading,
        },
        {
          ...openLinkMenuItem(() => {
            openDialog({ type: 'openLink' })
          }),
          disabled: loading,
        },
        exitMenuItem(onError),
      ],
    },
    {
      label: 'Tools',
      menuItems: () => [
        {
          label: 'Global plugins...',
          icon: ExtensionIcon,
          onClick: () => {
            openDialog({ type: 'globalPlugins' })
          },
        },
        safeMode
          ? {
              label: 'Reload with global plugins',
              icon: RefreshIcon,
              onClick: () => {
                reloadWithGlobalPlugins()
              },
            }
          : {
              label: 'Reload without global plugins',
              icon: ExtensionOffIcon,
              onClick: () => {
                reloadInSafeMode()
              },
            },
        ...pluginMenuItems(),
        {
          label: 'Factory reset...',
          icon: SettingsBackupRestoreIcon,
          disabled: loading,
          onClick: () => {
            openDialog({ type: 'factoryReset' })
          },
        },
      ],
    },
    {
      label: 'Help',
      menuItems: () => [
        {
          label: 'Documentation',
          icon: MenuBookIcon,
          onClick: () => {
            window.open('https://jbrowse.org/jb2/docs/', '_blank')
          },
        },
        {
          label: 'Report an issue',
          icon: BugReportIcon,
          onClick: () => {
            window.open(
              'https://github.com/GMOD/jbrowse-components/issues/new/choose',
              '_blank',
            )
          },
        },
        ...desktopHelpMenuItems(onError),
      ],
    },
  ] satisfies Menu[]
}

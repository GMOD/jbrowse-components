import AssistantIcon from '@mui/icons-material/Assistant'
import OpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import UpdateIcon from '@mui/icons-material/Update'

import { invokeIpc } from './ipc.ts'

import type { MenuItem } from '@jbrowse/core/ui'

export function openConfigFileMenuItem(
  open: (path: string) => Promise<void>,
  onError: (e: unknown) => void,
) {
  return {
    label: 'Open config.json or .jbrowse file...',
    icon: OpenIcon,
    onClick: async () => {
      try {
        const path = await invokeIpc('promptOpenFile')
        if (path) {
          await open(path)
        }
      } catch (e) {
        onError(e)
      }
    },
  } satisfies MenuItem
}

export function openLinkMenuItem(onClick: () => void) {
  return {
    label: 'Open JBrowse Web link...',
    icon: LinkIcon,
    onClick,
  } satisfies MenuItem
}

// with a session open, the main process's close guard flushes it on the way out
export function exitMenuItem(onError: (e: unknown) => void) {
  return {
    label: 'Exit',
    icon: MeetingRoomIcon,
    onClick: () => {
      invokeIpc('quit').catch(onError)
    },
  } satisfies MenuItem
}

// The native menu bar exists on macOS alone (electron/window.ts sets it to null
// elsewhere), so on Windows and Linux the start screen's and the session's Help
// menus are the only route to these. Each outcome is a native dialog raised by
// the main process, so only a failed call has anything to report.
export function desktopHelpMenuItems(onError: (e: unknown) => void) {
  return [
    {
      label: 'Check for updates...',
      icon: UpdateIcon,
      onClick: () => {
        invokeIpc('checkForUpdates').catch(onError)
      },
    },
    {
      label: 'Connect an AI agent...',
      icon: AssistantIcon,
      onClick: () => {
        invokeIpc('showConnectAgent').catch(onError)
      },
    },
  ] satisfies MenuItem[]
}

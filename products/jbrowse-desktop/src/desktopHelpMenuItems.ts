import AssistantIcon from '@mui/icons-material/Assistant'
import UpdateIcon from '@mui/icons-material/Update'

import { invokeIpc } from './ipc.ts'

import type { MenuItem } from '@jbrowse/core/ui'

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

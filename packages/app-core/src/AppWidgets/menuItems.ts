import { DNA } from '@jbrowse/core/ui/Icons'
import { getShareableSessionSnapshot } from '@jbrowse/product-core'
import AddIcon from '@mui/icons-material/Add'
import ExtensionIcon from '@mui/icons-material/Extension'
import GetAppIcon from '@mui/icons-material/GetApp'
import HelpIcon from '@mui/icons-material/Help'
import InfoIcon from '@mui/icons-material/Info'
import PublishIcon from '@mui/icons-material/Publish'
import RedoIcon from '@mui/icons-material/Redo'
import UndoIcon from '@mui/icons-material/Undo'

import { AssemblyManager } from '../AssemblyManager/index.ts'

import type { AssemblyManagerSession } from '../AssemblyManager/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  SessionWithWidgets,
} from '@jbrowse/core/util'

// the renderer binds the active session into each onClick (see AppToolbar's
// wrapMenuItems), so these handlers receive it as their argument

export function aboutMenuItem(): MenuItem {
  return {
    label: 'About',
    icon: InfoIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('AboutWidget', 'aboutWidget')
    },
  }
}

export function helpMenuItem(): MenuItem {
  return {
    label: 'Help',
    icon: HelpIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('HelpWidget', 'helpWidget')
    },
  }
}

// the "new session" action lives on the root, not the session, so these two take
// it rather than reading it off the bound argument like the rest
interface RootWithDefaultSession {
  setDefaultSession: () => void
}

export function newSessionMenuItem(root: RootWithDefaultSession): MenuItem {
  return {
    label: 'New session',
    icon: AddIcon,
    onClick: () => {
      root.setDefaultSession()
    },
  }
}

export function importSessionMenuItem(): MenuItem {
  return {
    label: 'Import session...',
    icon: PublishIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('ImportSessionWidget', 'importSessionWidget')
    },
  }
}

export function exportSessionMenuItem(): MenuItem {
  return {
    label: 'Export session',
    icon: GetAppIcon,
    onClick: async (session: AbstractSessionModel) => {
      const { saveAs } = await import('@jbrowse/core/util/FileSaver')
      saveAs(
        new Blob(
          [
            JSON.stringify(
              {
                // an exported file is read by someone whose own preferences
                // differ, so stamp what the live session resolves at read
                // time (same rule as ShareDialog)
                session: getShareableSessionSnapshot(session),
              },
              null,
              2,
            ),
          ],
          { type: 'text/plain;charset=utf-8' },
        ),
        'session.json',
      )
    },
  }
}

export function pluginStoreMenuItem(): MenuItem {
  return {
    label: 'Plugin store',
    icon: ExtensionIcon,
    onClick: (session: SessionWithWidgets) => {
      session.openWidget('PluginStoreWidget', 'pluginStoreWidget')
    },
  }
}

export function assemblyManagerMenuItem(): MenuItem {
  return {
    label: 'Assembly manager',
    icon: DNA,
    onClick: (session: AssemblyManagerSession) => {
      session.queueDialog(onClose => [AssemblyManager, { session, onClose }])
    },
  }
}

// undo/redo read the root's HistoryManagementMixin TimeTraveller; only the full
// app shells (jbrowse-web, desktop) compose it, so the node is passed in rather
// than reached for here
interface HistoryManager {
  canUndo: boolean
  canRedo: boolean
  undo(): void
  redo(): void
}

export function undoMenuItem(history: HistoryManager): MenuItem {
  return {
    label: 'Undo',
    icon: UndoIcon,
    onClick: () => {
      if (history.canUndo) {
        history.undo()
      }
    },
  }
}

export function redoMenuItem(history: HistoryManager): MenuItem {
  return {
    label: 'Redo',
    icon: RedoIcon,
    onClick: () => {
      if (history.canRedo) {
        history.redo()
      }
    },
  }
}

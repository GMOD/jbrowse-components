import { getSnapshot } from '@jbrowse/mobx-state-tree'
import ExtensionIcon from '@mui/icons-material/Extension'
import GetAppIcon from '@mui/icons-material/GetApp'
import PublishIcon from '@mui/icons-material/Publish'
import RedoIcon from '@mui/icons-material/Redo'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'
import { Cable } from '@jbrowse/core/ui/Icons'

import type { MenuItem } from '@jbrowse/core/ui'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

interface SessionWithViews {
  views: AbstractViewModel[]
}

interface HistoryManager {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function getOpenTrackMenuItem(): MenuItem {
  return {
    label: 'Open track...',
    icon: StorageIcon,
    onClick: (session: SessionWithWidgets) => {
      if (session.views.length === 0) {
        session.notify('Please open a view to add a track first')
      } else if (session.views.length > 0) {
        const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
          view: session.views[0]!.id,
        })
        session.showWidget(widget)
        if (session.views.length > 1) {
          session.notify(
            'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right',
          )
        }
      }
    },
  }
}

export function getOpenConnectionMenuItem(): MenuItem {
  return {
    label: 'Open connection...',
    icon: Cable,
    onClick: (session: SessionWithWidgets) => {
      const widget = session.addWidget(
        'AddConnectionWidget',
        'addConnectionWidget',
      )
      session.showWidget(widget)
    },
  }
}

export function getUndoMenuItem(
  getHistory: () => HistoryManager | undefined,
): MenuItem {
  return {
    label: 'Undo',
    icon: UndoIcon,
    onClick: () => {
      const history = getHistory()
      if (history?.canUndo) {
        history.undo()
      }
    },
  }
}

export function getRedoMenuItem(
  getHistory: () => HistoryManager | undefined,
): MenuItem {
  return {
    label: 'Redo',
    icon: RedoIcon,
    onClick: () => {
      const history = getHistory()
      if (history?.canRedo) {
        history.redo()
      }
    },
  }
}

export function getPluginStoreMenuItem(
  getSession: () => SessionWithWidgets | undefined,
): MenuItem {
  return {
    label: 'Plugin store',
    icon: ExtensionIcon,
    onClick: () => {
      const session = getSession()
      if (session) {
        session.showWidget(
          session.addWidget('PluginStoreWidget', 'pluginStoreWidget'),
        )
      }
    },
  }
}

export function getImportSessionMenuItem(): MenuItem {
  return {
    label: 'Import session…',
    icon: PublishIcon,
    onClick: (session: SessionWithWidgets) => {
      const widget = session.addWidget(
        'ImportSessionWidget',
        'importSessionWidget',
      )
      session.showWidget(widget)
    },
  }
}

export function getExportSessionMenuItem(): MenuItem {
  return {
    label: 'Export session',
    icon: GetAppIcon,
    onClick: async (session: IAnyStateTreeNode) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const { saveAs } = await import('file-saver-es')

      saveAs(
        new Blob([JSON.stringify({ session: getSnapshot(session) }, null, 2)], {
          type: 'text/plain;charset=utf-8',
        }),
        'session.json',
      )
    },
  }
}

import { Cable } from '@jbrowse/core/ui/Icons'
import ExtensionIcon from '@mui/icons-material/Extension'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'

import type { SessionWithMultipleViews } from '../Session/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  DialogComponentType,
  SessionWithWidgets,
} from '@jbrowse/core/util'

// the renderer binds the active session into each onClick (see AppToolbar's
// wrapMenuItems), so these handlers receive it as their argument

const MULTI_VIEW_WARNING =
  'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right'

const WORKSPACES_HELP_TEXT =
  'Workspaces allow you to organize views into tabs and tiles. There are a variety of unique features, for instance, you can drag views between tabs or split them side-by-side. Try clicking and dragging the tab header to create a new split'

export function openTrackMenuItem(): MenuItem {
  return {
    label: 'Open track...',
    icon: StorageIcon,
    onClick: (session: SessionWithWidgets) => {
      const firstView = session.views[0]
      if (!firstView) {
        session.notify('Please open a view to add a track first')
      } else {
        const widget = session.addWidget('AddTrackWidget', 'addTrackWidget', {
          view: firstView.id,
        })
        session.showWidget(widget)
        if (session.views.length > 1) {
          session.notify(MULTI_VIEW_WARNING)
        }
      }
    },
  }
}

export function openConnectionMenuItem(): MenuItem {
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

export function pluginStoreMenuItem(): MenuItem {
  return {
    label: 'Plugin store',
    icon: ExtensionIcon,
    onClick: (session: SessionWithWidgets) => {
      session.showWidget(
        session.addWidget('PluginStoreWidget', 'pluginStoreWidget'),
      )
    },
  }
}

// the dialog component differs per product, so it is passed in rather than
// imported; typing it as DialogComponentType lets queueDialog accept it with no
// cast (the inline call sites needed `as BaseSession` to reach queueDialog)
export function preferencesMenuItem(
  pluginManager: PluginManager,
  PreferencesDialog: DialogComponentType,
): MenuItem {
  return {
    label: 'Preferences',
    icon: SettingsIcon,
    onClick: (session: AbstractSessionModel) => {
      session.queueDialog(handleClose => [
        PreferencesDialog,
        { session, pluginManager, handleClose },
      ])
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

export function workspacesMenuItem(
  session: SessionWithMultipleViews | undefined,
): MenuItem {
  return {
    label: 'Use workspaces',
    icon: SpaceDashboardIcon,
    type: 'checkbox',
    checked: session?.effectiveUseWorkspaces ?? false,
    helpText: WORKSPACES_HELP_TEXT,
    onClick: () => {
      session?.setUseWorkspacesPreference(!session.effectiveUseWorkspaces)
    },
  }
}

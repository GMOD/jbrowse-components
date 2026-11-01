import { lazy } from 'react'

import { Cable } from '@jbrowse/core/ui/Icons'
import SettingsIcon from '@mui/icons-material/Settings'
import StorageIcon from '@mui/icons-material/Storage'

import type { PreferencesDialogSession } from '../ui/PreferencesDialog.tsx'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractSessionModel,
  SessionWithWidgets,
} from '@jbrowse/core/util'

const PreferencesDialog = lazy(() => import('../ui/PreferencesDialog.tsx'))

// the renderer binds the active session into each onClick (see AppToolbar's
// wrapMenuItems), so these handlers receive it as their argument

const MULTI_VIEW_WARNING =
  'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right'

export function openTrackMenuItem(): MenuItem {
  return {
    label: 'Open track...',
    icon: StorageIcon,
    onClick: (session: SessionWithWidgets) => {
      const firstView = session.views[0]
      if (!firstView) {
        session.notify('Please open a view to add a track first')
      } else {
        session.openWidget('AddTrackWidget', 'addTrackWidget', {
          view: firstView.id,
        })
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
      session.openWidget('AddConnectionWidget', 'addConnectionWidget')
    },
  }
}

export function preferencesMenuItem(pluginManager: PluginManager): MenuItem {
  return {
    label: 'Preferences',
    icon: SettingsIcon,
    onClick: (session: AbstractSessionModel & PreferencesDialogSession) => {
      session.queueDialog(handleClose => [
        PreferencesDialog,
        { session, pluginManager, handleClose },
      ])
    },
  }
}

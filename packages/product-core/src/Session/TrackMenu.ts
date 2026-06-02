import { lazy } from 'react'

import { InfoIcon } from '@jbrowse/core/ui/Icons'
import { types } from '@jbrowse/mobx-state-tree'

import type { BaseSession } from './BaseSession.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { DialogComponentType } from '@jbrowse/core/util'

const AboutDialog = lazy(() => import('../ui/AboutDialog.tsx'))

interface SessionWithDialog {
  queueDialog: (
    cb: (done: () => void) => [DialogComponentType, Record<string, unknown>],
  ) => void
}

type TrackConfig = AnyConfigurationModel | Record<string, unknown>

/** "About track" menu item, shared by every product's track menu */
export function aboutTrackMenuItem(
  session: SessionWithDialog,
  config: TrackConfig,
): MenuItem {
  return {
    label: 'About track',
    icon: InfoIcon,
    onClick: () => {
      session.queueDialog(handleClose => [
        AboutDialog,
        { config, session, handleClose },
      ])
    },
  }
}

/**
 * flattened track menu (About + raw actions) for the hierarchical track selector
 */
export function trackListMenuItems(
  session: SessionWithDialog,
  config: TrackConfig,
  actions: MenuItem[],
): MenuItem[] {
  return [aboutTrackMenuItem(session, config), ...actions]
}

/**
 * track menu with an "About track" item and a "Track actions" submenu, for the
 * in-view track label menu. `aboutConfig` is the config shown in the About
 * dialog (the active display's effective config)
 */
export function trackActionMenuItems(
  session: SessionWithDialog,
  aboutConfig: TrackConfig,
  actions: MenuItem[],
  extraTrackActions?: MenuItem[],
): MenuItem[] {
  return [
    {
      ...aboutTrackMenuItem(session, aboutConfig),
      priority: 1002,
    },
    {
      type: 'subMenu' as const,
      label: 'Track actions',
      priority: 1001,
      subMenu: [...actions, ...(extraTrackActions ?? [])],
    },
    { type: 'divider' as const },
  ]
}

/**
 * #stateModel TrackMenuSessionMixin
 */
export function TrackMenuSessionMixin(_pluginManager: PluginManager) {
  return types.model('TrackMenuSessionMixin', {}).views(s => {
    const self = s as typeof s & BaseSession
    return {
      /**
       * #method
       */
      getTrackActionMenuItems(
        _config: AnyConfigurationModel,
        extraTrackActions: MenuItem[] | undefined,
        effectiveConfig: Record<string, unknown>,
        _view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        return [
          aboutTrackMenuItem(self, effectiveConfig),
          ...(extraTrackActions ?? []),
        ]
      },
    }
  })
}

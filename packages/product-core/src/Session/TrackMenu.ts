import { lazy } from 'react'

import { InfoIcon } from '@jbrowse/core/ui/Icons'
import { getSnapshot, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'

import type { BaseSession } from './BaseSession.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type { DialogComponentType } from '@jbrowse/core/util'

const AboutDialog = lazy(() => import('../ui/AboutDialog.tsx'))

type TrackCopySnapshot = {
  trackId: string
  name: string
  category?: unknown
  displays?: { type: string; displayId: string }[]
} & Record<string, unknown>

/**
 * Clone a track config for "Copy track": snapshots the config, appends a unique
 * suffix to trackId (so it doesn't collide with the original), tags " (copy)"
 * on the name, and regenerates each displayId to the canonical
 * `${trackId}-${type}` form baseTrackConfig auto-injects — keeping them unique
 * (displayId is a types.identifier, so a collision would crash MST).
 */
export function copyTrackSnapshot(
  config: BaseTrackConfig,
  opts: { sessionTrack?: boolean; clearCategory: boolean },
): TrackCopySnapshot {
  const snap = structuredClone(
    isStateTreeNode(config) ? getSnapshot(config) : config,
  ) as TrackCopySnapshot
  snap.trackId += `-${Date.now()}`
  // the -sessionTrack suffix is metadata for the track selector to store the
  // copy in a special category
  if (opts.sessionTrack) {
    snap.trackId += '-sessionTrack'
  }
  snap.name += ' (copy)'
  if (opts.clearCategory) {
    snap.category = undefined
  }
  for (const d of snap.displays ?? []) {
    d.displayId = `${snap.trackId}-${d.type}`
  }
  return snap
}

interface TrackActionSession<C> {
  editConfiguration: (config: AnyConfigurationModel | { trackId: string }) => void
  addTrackConf: (conf: C) => unknown
  deleteTrackConf: (conf: AnyConfigurationModel) => void
}

/**
 * The shared Settings / Copy / Copy-and-open / Delete track actions. Each
 * product supplies `makeCopy` (its own session-track/category rules) and
 * `canEdit`; reference sequence tracks can't be copied or deleted.
 */
export function trackActionItems<C extends { trackId: string }>({
  session,
  config,
  view,
  canEdit,
  makeCopy,
}: {
  session: TrackActionSession<C>
  config: BaseTrackConfig
  view?: { showTrack: (id: string) => void }
  canEdit: boolean
  makeCopy: () => C
}): MenuItem[] {
  const isRefSeq = config.type === 'ReferenceSequenceTrack'
  return [
    {
      label: 'Settings',
      icon: SettingsIcon,
      disabled: !canEdit,
      onClick: () => {
        // guard in addition to `disabled` so a non-session track can never be
        // edited even if a renderer ignores the disabled flag
        if (canEdit) {
          session.editConfiguration(config)
        }
      },
    },
    {
      label: 'Copy track',
      icon: CopyIcon,
      disabled: isRefSeq,
      onClick: () => {
        session.addTrackConf(makeCopy())
      },
    },
    {
      label: 'Copy and open track',
      icon: OpenInNewIcon,
      disabled: isRefSeq || !view,
      onClick: () => {
        const snap = makeCopy()
        if (session.addTrackConf(snap)) {
          view!.showTrack(snap.trackId)
        }
      },
    },
    {
      label: 'Delete track',
      icon: DeleteIcon,
      disabled: !canEdit || isRefSeq,
      onClick: () => {
        session.deleteTrackConf(config)
      },
    },
  ]
}

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

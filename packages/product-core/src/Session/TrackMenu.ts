import { lazy } from 'react'

import { InfoIcon } from '@jbrowse/core/ui/Icons'
import { buildExtraTrackMenuItems } from '@jbrowse/core/ui/buildExtraTrackMenuItems'
import { getSnapshot, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type { DialogComponentType } from '@jbrowse/core/util'
import type {
  AbstractSessionModel,
  TrackActionView,
} from '@jbrowse/core/util/types'

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
  editConfiguration: (
    config: AnyConfigurationModel | { trackId: string },
    opts?: { expandedDisplayId?: string },
  ) => void
  addTrackConf: (conf: C) => unknown
  deleteTrackConf: (conf: AnyConfigurationModel) => void
  resetTrackConfiguration?: (trackId: string) => void
}

/**
 * The shared Settings / Copy / Copy-and-open / Delete track actions. Each
 * product supplies `makeCopy` (its own session-track/category rules) and
 * `canEdit`; reference sequence tracks can't be copied or deleted. When
 * `isSessionOverride` is set the track is a session edit shadowing an
 * admin-owned config track, so the final action resets it instead of deleting.
 */
export function trackActionItems<C extends { trackId: string }>({
  session,
  config,
  view,
  canEdit,
  isSessionOverride,
  makeCopy,
}: {
  session: TrackActionSession<C>
  config: BaseTrackConfig
  view?: TrackActionView
  canEdit: boolean
  isSessionOverride?: boolean
  makeCopy: () => C
}): MenuItem[] {
  const isRefSeq = config.type === 'ReferenceSequenceTrack'
  // the display active in this view expands in the config editor, so the
  // track's other (incompatible/inactive) displays start collapsed
  const expandedDisplayId = view?.getActiveDisplayId?.(config.trackId)
  return [
    {
      // always available: editing a non-session (admin-owned) track applies
      // in-memory for the current session even when the user can't persist it
      label: 'Settings',
      icon: SettingsIcon,
      onClick: () => {
        session.editConfiguration(config, { expandedDisplayId })
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
    isSessionOverride
      ? {
          // a session edit of an admin-owned track: the underlying config track
          // can't be deleted, so offer to discard the edits instead
          label: 'Reset track settings',
          icon: SettingsBackupRestoreIcon,
          onClick: () => {
            session.resetTrackConfiguration?.(config.trackId)
          },
        }
      : {
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
 * plugin-contributed per-track items (`Core-extraTrackMenuItems`), surfaced in
 * both the hierarchical selector and the in-view label menu so plugins reach
 * every track menu consistently
 */
export function pluginExtraTrackItems(
  pluginManager: PluginManager,
  session: SessionWithDialog,
  config: AnyConfigurationModel,
  view?: TrackActionView,
): MenuItem[] {
  return buildExtraTrackMenuItems(pluginManager, {
    session: session as unknown as AbstractSessionModel,
    config,
    view,
  })
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
 * in-view track label menu
 */
export function trackActionMenuItems(
  session: SessionWithDialog,
  config: TrackConfig,
  actions: MenuItem[],
): MenuItem[] {
  return [
    {
      ...aboutTrackMenuItem(session, config),
      priority: 1002,
    },
    {
      type: 'subMenu' as const,
      label: 'Track actions',
      priority: 1001,
      subMenu: actions,
    },
    { type: 'divider' as const },
  ]
}

interface SessionWithGetTrackActions extends SessionWithDialog {
  getTrackActions(config: BaseTrackConfig, view?: TrackActionView): MenuItem[]
}

// (TrackMenuSessionMixin — the minimal embedded-view variant — lives in its own
// file so each documented state model is the sole one in its file, which the
// autogen docs generator requires.)

/**
 * #stateModel TrackMenuItemsSessionMixin
 *
 * The two track-menu wrappers (`getTrackListMenuItems` for the hierarchical
 * selector, `getTrackActionMenuItems` for the in-view label menu) shared by the
 * full web and desktop sessions. Both are pure functions of `getTrackActions`,
 * which each session supplies (web gates on edit rights; desktop adds indexing).
 */
export function TrackMenuItemsSessionMixin(pluginManager: PluginManager) {
  return types.model('TrackMenuItemsSessionMixin', {}).views(s => {
    const self = s as typeof s & SessionWithGetTrackActions
    return {
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        config: BaseTrackConfig,
        view?: TrackActionView,
      ): MenuItem[] {
        return [
          ...trackListMenuItems(
            self,
            config,
            self.getTrackActions(config, view),
          ),
          ...pluginExtraTrackItems(pluginManager, self, config, view),
        ]
      },
      /**
       * #method
       * track menu with About + "Track actions" submenu for the in-view label
       */
      getTrackActionMenuItems({
        config,
        view,
      }: {
        config: BaseTrackConfig
        view?: TrackActionView
      }): MenuItem[] {
        return trackActionMenuItems(self, config, [
          ...self.getTrackActions(config, view),
          ...pluginExtraTrackItems(pluginManager, self, config, view),
        ])
      },
    }
  })
}

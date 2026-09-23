import { lazy } from 'react'

import { InfoIcon } from '@jbrowse/core/ui/Icons'
import { namesTemporaryAssembly } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore'

import { pluginExtraTrackItems } from './pluginExtraTrackItems.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type { DialogComponentType } from '@jbrowse/core/util'
import type { TrackActionView } from '@jbrowse/core/util/types'

const AboutDialog = lazy(() => import('../ui/AboutDialog.tsx'))

interface TrackActionSession<C> {
  editConfiguration: (
    config: AnyConfigurationModel | { trackId: string },
    opts?: { expandedDisplayId?: string },
  ) => void
  publishTrackConf: (conf: C) => unknown
  deleteTrackConf: (conf: AnyConfigurationModel) => void
  resetTrackConfiguration?: (trackId: string) => void
  /**
   * Declared here, though only the copy guard below reads it, so a session that
   * loses the list loses the guard *loudly*. `namesTemporaryAssembly` takes an
   * `unknown` session and answers false for one that holds no such list, which
   * is right for a caller that genuinely has none and wrong for one that let it
   * drop — and that second case is a copy action silently offered again.
   *
   * `unknown[]`, the spelling `AbstractSessionModel` already uses, and not the
   * `{ name?: string }[]` the guard narrows to: that one is a weak type, so a
   * real MST array of assembly configs — whose element type is an index
   * signature that declares no `name` — shares no property with it and TS
   * rejects the assignment. The shape belongs in the guard, which is the only
   * thing that reads it.
   */
  temporaryAssemblies?: unknown[]
}

/**
 * The shared Settings / Copy / Copy-and-open / Delete track actions. Each
 * product supplies `makeCopy` (its own session-track/category rules) and
 * `canEdit`; reference sequence tracks can't be copied or deleted. When
 * `isSessionOverride` is set the track carries session edits over its base
 * config, so a Reset is offered, and it replaces Delete for a user who cannot
 * delete the base.
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
  // A copy of a track drawn on an assembly this view synthesized is dead on
  // arrival: the assembly goes back when the view closes, and the copy is left
  // naming one that never existed anywhere else. Both destinations were wrong
  // for it — `publishTrackConf` writes an admin's into the config.json every
  // visitor is served, one per click since the copy's stamped trackId defeats
  // the dedupe, and a non-admin's lands as the dead `sessionTracks` entry
  // ADR-084 removed the sweep for. Neither is worth offering, so the item says
  // so instead of producing garbage; the contract check on the adders
  // is what found this.
  //
  // Greying a row tells nobody anything, and this reason is one nobody guesses:
  // a refseq track explains its own greyed Copy, a synteny band that looks like
  // every other track does not. `disabledHelpText` is what says it.
  const isTemporary = namesTemporaryAssembly(session, config)
  const copyRefusal = isRefSeq
    ? 'A reference sequence track cannot be copied.'
    : isTemporary
      ? 'This track is drawn on an assembly this view synthesized, which goes away with the view — a copy of it would name an assembly nothing can resolve.'
      : undefined
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
      disabled: isRefSeq || isTemporary,
      disabledHelpText: copyRefusal,
      onClick: () => {
        session.publishTrackConf(makeCopy())
      },
    },
    {
      label: 'Copy and open track',
      icon: OpenInNewIcon,
      disabled: isRefSeq || isTemporary || !view,
      disabledHelpText:
        copyRefusal ?? (view ? undefined : 'No view to open the copy in.'),
      onClick: () => {
        const snap = makeCopy()
        if (session.publishTrackConf(snap)) {
          void view!.launchTrack(snap.trackId)
        }
      },
    },
    ...(isSessionOverride
      ? [
          {
            label: 'Reset track settings',
            icon: SettingsBackupRestoreIcon,
            onClick: () => {
              session.resetTrackConfiguration?.(config.trackId)
            },
          },
        ]
      : []),
    ...(isSessionOverride && !canEdit
      ? []
      : [
          {
            label: 'Delete track',
            icon: DeleteIcon,
            disabled: !canEdit || isRefSeq,
            onClick: () => {
              session.deleteTrackConf(config)
            },
          },
        ]),
  ]
}

export interface SessionWithDialog {
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

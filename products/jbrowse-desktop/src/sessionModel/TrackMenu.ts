import { lazy } from 'react'

import { Indexing } from '@jbrowse/core/ui/Icons'
import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import {
  getParent,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import {
  defaultAttributesToIndex,
  defaultFeatureTypesToExclude,
} from '@jbrowse/text-indexing'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import InfoIcon from '@mui/icons-material/Info'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SettingsIcon from '@mui/icons-material/Settings'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  BaseSession,
  SessionWithDrawerWidgets,
  SessionWithTracks,
} from '@jbrowse/product-core'

type SessionBase = BaseSession & SessionWithTracks & SessionWithDrawerWidgets

const AboutDialog = lazy(() => import('@jbrowse/product-core/src/ui/AboutDialog'))

/**
 * #stateModel DesktopSessionTrackMenuMixin
 */
export function DesktopSessionTrackMenuMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .views(self => ({
      /**
       * #method
       * raw track actions (Settings, Copy, Delete, Index) without submenu wrapper
       */
      getTrackActions(
        trackConfig: BaseTrackConfig,
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        const session = self as SessionBase
        const base = structuredClone(
          isStateTreeNode(trackConfig) ? getSnapshot(trackConfig) : trackConfig,
        )
        const makeSnap = () => {
          const snap = structuredClone(base)
          const now = Date.now()
          snap.trackId += `-${now}`
          if (snap.displays) {
            for (const d of snap.displays) {
              d.displayId += `-${now}`
            }
          }
          snap.name += ' (copy)'
          snap.category = undefined
          return snap
        }
        return [
          {
            label: 'Settings',
            onClick: () => {
              session.editConfiguration(trackConfig)
            },
            icon: SettingsIcon,
          },
          {
            label: 'Copy track',
            onClick: () => {
              session.addTrackConf(makeSnap())
            },
            icon: CopyIcon,
          },
          {
            label: 'Copy and open track',
            disabled: !view,
            onClick: () => {
              const snap = makeSnap()
              session.addTrackConf(snap)
              view!.showTrack(snap.trackId)
            },
            icon: OpenInNewIcon,
          },
          {
            label: 'Delete track',
            onClick: () => {
              session.deleteTrackConf(trackConfig)
            },
            icon: DeleteIcon,
          },
          ...(isSupportedIndexingAdapter(base.adapter?.type)
            ? [
                {
                  label: base.textSearching ? 'Re-index track' : 'Index track',
                  onClick: () => {
                    const rootModel = getParent<DesktopRootModel>(self)
                    const { trackId, assemblyNames, textSearching } = base
                    rootModel.jobsManager.queueJob({
                      indexingParams: {
                        attributes:
                          textSearching?.indexingAttributes ??
                          defaultAttributesToIndex,
                        exclude:
                          textSearching?.indexingFeatureTypesToExclude ??
                          defaultFeatureTypesToExclude,
                        assemblies: assemblyNames,
                        tracks: [trackId],
                        indexType: 'perTrack',
                        timestamp: new Date().toISOString(),
                        name: trackId,
                      },
                      // jobs are keyed by name; trackId is unique so two tracks
                      // sharing a display name won't collide
                      name: trackId,
                    })
                  },
                  icon: Indexing,
                },
              ]
            : []),
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       * flattened menu items for use in hierarchical track selector
       */
      getTrackListMenuItems(
        trackConfig: BaseTrackConfig,
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        const session = self as unknown as SessionBase
        return [
          {
            label: 'About track',
            onClick: () => {
              session.queueDialog(doneCallback => [
                AboutDialog,
                { config: trackConfig, session, handleClose: doneCallback },
              ])
            },
            icon: InfoIcon,
          },
          ...self.getTrackActions(trackConfig, view),
        ]
      },

      /**
       * #method
       */
      getTrackActionMenuItems(
        trackConfig: BaseTrackConfig,
        extraTrackActions?: MenuItem[],
        effectiveConfig?: Record<string, unknown>,
        view?: { showTrack: (id: string) => void },
      ): MenuItem[] {
        const session = self as unknown as SessionBase
        return [
          {
            label: 'About track',
            priority: 1002,
            onClick: () => {
              session.queueDialog(doneCallback => [
                AboutDialog,
                {
                  config: effectiveConfig ?? trackConfig,
                  session,
                  handleClose: doneCallback,
                },
              ])
            },
            icon: InfoIcon,
          },
          {
            type: 'subMenu' as const,
            label: 'Track actions',
            priority: 1001,
            subMenu: [
              ...self.getTrackActions(trackConfig, view),
              ...(extraTrackActions ?? []),
            ],
          },
          { type: 'divider' as const },
        ]
      },
    }))
}

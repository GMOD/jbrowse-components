import { lazy } from 'react'

import { Indexing } from '@jbrowse/core/ui/Icons'
import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import {
  getParent,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
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
  SessionWithDialogs,
  SessionWithDrawerWidgets,
  SessionWithTracks,
} from '@jbrowse/product-core'

const AboutDialog = lazy(() => import('./AboutDialog.tsx'))

/**
 * #stateModel DesktopSessionTrackMenuMixin
 */
export function DesktopSessionTrackMenuMixin(_pluginManager: PluginManager) {
  return types.model({}).views(self => ({
    /**
     * #method
     * raw track actions (Settings, Copy, Delete, Index) without submenu wrapper
     */
    getTrackActions(
      trackConfig: BaseTrackConfig,
      view?: { showTrack: (id: string) => void },
    ): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets
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
                label: base.textSearching
                  ? 'Re-index track'
                  : 'Index track',
                onClick: () => {
                  const rootModel = getParent<DesktopRootModel>(self)
                  const { jobsManager } = rootModel
                  const { trackId, assemblyNames, textSearching, name } =
                    base
                  const indexName = `${name}-index`
                  // TODO: open jobs list widget
                  jobsManager.queueJob({
                    indexingParams: {
                      attributes: textSearching?.indexingAttributes || [
                        'Name',
                        'ID',
                      ],
                      exclude: textSearching?.indexingFeatureTypesToExclude || [
                        'CDS',
                        'exon',
                      ],
                      assemblies: assemblyNames,
                      tracks: [trackId],
                      indexType: 'perTrack',
                      timestamp: new Date().toISOString(),
                      name: indexName,
                    },
                    name: indexName,
                  })
                },
                icon: Indexing,
              },
            ]
          : []),
      ]
    },

    /**
     * #method
     * flattened menu items for use in hierarchical track selector
     */
    getTrackListMenuItems(
      trackConfig: BaseTrackConfig,
      view?: { showTrack: (id: string) => void },
    ): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets & {
          getTrackActions: (
            c: BaseTrackConfig,
            v?: { showTrack: (id: string) => void },
          ) => MenuItem[]
        }
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
        ...session.getTrackActions(trackConfig, view),
      ]
    },

    /**
     * #method
     */
    getTrackActionMenuItems(
      trackConfig: BaseTrackConfig,
      extraTrackActions?: MenuItem[],
      view?: { showTrack: (id: string) => void },
    ): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets & {
          getTrackActions: (
            c: BaseTrackConfig,
            v?: { showTrack: (id: string) => void },
          ) => MenuItem[]
        }
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
        {
          type: 'subMenu' as const,
          label: 'Track actions',
          subMenu: [
            ...session.getTrackActions(trackConfig, view),
            ...(extraTrackActions || []),
          ],
        },
        { type: 'divider' as const },
      ]
    },
  }))
}

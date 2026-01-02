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
import SettingsIcon from '@mui/icons-material/Settings'

import type { DesktopRootModel } from '../rootModel/rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  SessionWithDialogs,
  SessionWithDrawerWidgets,
  SessionWithTracks,
} from '@jbrowse/product-core'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel DesktopSessionTrackMenuMixin
 */
export function DesktopSessionTrackMenuMixin(_pluginManager: PluginManager) {
  return types.model({}).views(self => ({
    /**
     * #method
     * raw track actions (Settings, Copy, Delete, Index) without submenu wrapper
     */
    getTrackActions(trackConfig: BaseTrackConfig): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets
      const trackSnapshot = structuredClone(
        isStateTreeNode(trackConfig) ? getSnapshot(trackConfig) : trackConfig,
      )
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
            const now = Date.now()
            trackSnapshot.trackId += `-${now}`
            if (trackSnapshot.displays) {
              for (const d of trackSnapshot.displays) {
                d.displayId += `-${now}`
              }
            }
            trackSnapshot.name += ' (copy)'
            trackSnapshot.category = undefined
            session.addTrackConf(trackSnapshot)
          },
          icon: CopyIcon,
        },
        {
          label: 'Delete track',
          onClick: () => {
            session.deleteTrackConf(trackConfig)
          },
          icon: DeleteIcon,
        },
        ...(isSupportedIndexingAdapter(trackSnapshot.adapter?.type)
          ? [
              {
                label: trackSnapshot.textSearching
                  ? 'Re-index track'
                  : 'Index track',
                onClick: () => {
                  const rootModel = getParent<DesktopRootModel>(self)
                  const { jobsManager } = rootModel
                  const { trackId, assemblyNames, textSearching, name } =
                    trackSnapshot
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
    getTrackListMenuItems(trackConfig: BaseTrackConfig): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets & {
          getTrackActions: (c: BaseTrackConfig) => MenuItem[]
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
        ...session.getTrackActions(trackConfig),
      ]
    },

    /**
     * #method
     */
    getTrackActionMenuItems(
      trackConfig: BaseTrackConfig,
      extraTrackActions?: MenuItem[],
    ): MenuItem[] {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets & {
          getTrackActions: (c: BaseTrackConfig) => MenuItem[]
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
            ...session.getTrackActions(trackConfig),
            ...(extraTrackActions || []),
          ],
        },
        { type: 'divider' as const },
      ]
    },
  }))
}

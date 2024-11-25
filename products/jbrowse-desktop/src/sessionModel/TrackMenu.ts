import { lazy } from 'react'

import { Indexing } from '@jbrowse/core/ui/Icons'
import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import CopyIcon from '@mui/icons-material/FileCopy'
import InfoIcon from '@mui/icons-material/Info'

import SettingsIcon from '@mui/icons-material/Settings'
import clone from 'clone'
import { getParent, getSnapshot, types } from 'mobx-state-tree'

import type { DesktopRootModel } from '../rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type {
  SessionWithDialogs,
  SessionWithTracks,
  SessionWithDrawerWidgets,
} from '@jbrowse/product-core'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel DesktopSessionTrackMenuMixin
 */
export function DesktopSessionTrackMenuMixin(_pluginManager: PluginManager) {
  return types.model({}).views(self => ({
    /**
     * #method
     */
    getTrackActionMenuItems(trackConfig: BaseTrackConfig) {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets
      const trackSnapshot = clone(getSnapshot(trackConfig))
      return [
        {
          label: 'About track',
          onClick: () => {
            session.queueDialog(doneCallback => [
              AboutDialog,
              { config: trackConfig, handleClose: doneCallback },
            ])
          },
          icon: InfoIcon,
        },
        {
          label: 'Settings',
          onClick: () => {
            session.editConfiguration(trackConfig)
          },
          icon: SettingsIcon,
        },
        {
          label: 'Delete track',
          onClick: () => {
            session.deleteTrackConf(trackConfig)
          },
          icon: DeleteIcon,
        },
        {
          label: 'Copy track',
          onClick: () => {
            const now = Date.now()
            trackSnapshot.trackId += `-${now}`
            trackSnapshot.displays.forEach((d: { displayId: string }) => {
              d.displayId += `-${now}`
            })
            trackSnapshot.name += ' (copy)'
            trackSnapshot.category = undefined
            session.addTrackConf(trackSnapshot)
          },
          icon: CopyIcon,
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
  }))
}

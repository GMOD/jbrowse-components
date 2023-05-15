import { lazy } from 'react'
import { getParent, getSnapshot, types } from 'mobx-state-tree'

import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'
import { Indexing } from '@jbrowse/core/ui/Icons'

import PluginManager from '@jbrowse/core/PluginManager'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { supportedIndexingAdapters } from '@jbrowse/text-indexing'

import type { SessionWithDialogs } from '@jbrowse/product-core/src/Session/DialogQueue'
import type { SessionWithTracks } from '@jbrowse/product-core/src/Session/Tracks'
import type { SessionWithDrawerWidgets } from '@jbrowse/product-core/src/Session/DrawerWidgets'
import { DesktopRootModel } from '../rootModel'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel JBrowseDesktopSessionTrackMenuMixin
 */
export default function TrackMenu(pluginManager: PluginManager) {
  return types.model({}).views(self => ({
    /**
     * #method
     */
    getTrackActionMenuItems(trackConfig: BaseTrackConfig) {
      const session = self as SessionWithDialogs &
        SessionWithTracks &
        SessionWithDrawerWidgets
      const trackSnapshot = JSON.parse(JSON.stringify(getSnapshot(trackConfig)))
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
          onClick: () => session.editConfiguration(trackConfig),
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
        {
          label: trackSnapshot.textSearching ? 'Re-index track' : 'Index track',
          disabled: !supportedIndexingAdapters(trackSnapshot.adapter.type),
          onClick: () => {
            const rootModel = getParent<DesktopRootModel>(self)
            const { jobsManager } = rootModel
            const { trackId, assemblyNames, textSearching, name } =
              trackSnapshot
            const indexName = `${name}-index`
            // TODO: open jobs list widget
            jobsManager?.queueJob({
              indexingParams: {
                attributes: textSearching?.indexingAttributes || ['Name', 'ID'],
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
              cancelCallback: () => jobsManager.abortJob(),
            })
          },
          icon: Indexing,
        },
      ]
    },
  }))
}

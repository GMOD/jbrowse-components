import { Instance, addDisposer, getParent, types } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'
import type { BaseSessionModel } from '../../../../products/jbrowse-desktop/src/sessionModel/Base'
import { ThemeOptions } from '@mui/material'
import { autorun } from 'mobx'
import DrawerWidgets from './DrawerWidgets'
import BaseSession from './Base'

export default function Tracks(pluginManager: PluginManager) {
  return types
    .compose('TracksManagerSessionMixin',
        BaseSession(pluginManager),
        ReferenceManagement(pluginManager)
    )
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return getParent<any>(self).jbrowse.tracks
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addTrackConf(trackConf: any) {
        return getParent<any>(self).jbrowse.addTrackConf(trackConf)
      },

      /**
       * #action
       */
      deleteTrackConf(trackConf: AnyConfigurationModel) {
        const callbacksToDereferenceTrack: Function[] = []
        const dereferenceTypeCount: Record<string, number> = {}
        const referring = self.getReferring(trackConf)
        self.removeReferring(
          referring,
          trackConf,
          callbacksToDereferenceTrack,
          dereferenceTypeCount,
        )
        callbacksToDereferenceTrack.forEach(cb => cb())
        if (self.adminMode) {
          return getParent<any>(self).jbrowse.deleteTrackConf(trackConf)
        }
      },
    }))
}

export type TracksManager = Instance<ReturnType<typeof Tracks>>
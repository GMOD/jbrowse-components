import {
  hideTrackGeneric,
  showTrackGeneric,
  toggleTrackGeneric,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { getParent, types } from 'mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

export function linearSyntenyViewHelperModelFactory(
  pluginManager: PluginManager,
) {
  return types
    .model('LinearSyntenyViewHelper', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: 'LinearSyntenyViewHelper',
      /**
       * #property
       */
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      /**
       * #property
       */
      height: 100,
      /**
       * #property
       */
      level: types.number,
    })
    .actions(self => ({
      /**
       * #action
       */
      setHeight(n: number) {
        self.height = n
        return self.height
      },

      /**
       * #action
       */
      showTrack(trackId: string, initialSnapshot = {}) {
        return showTrackGeneric(self, trackId, initialSnapshot)
      },

      /**
       * #action
       */
      hideTrack(trackId: string) {
        return hideTrackGeneric(self, trackId)
      },
      /**
       * #action
       */
      toggleTrack(trackId: string) {
        toggleTrackGeneric(self, trackId)
      },
    }))
    .views(self => ({
      get assemblyNames() {
        const p = getParent<{ views: LinearGenomeViewModel[] }>(self, 2)
        return [
          p.views[self.level]!.assemblyNames[0],
          p.views[self.level + 1]!.assemblyNames[0],
        ]
      },
    }))
}

export type LinearSyntenyViewHelperStateModel = ReturnType<
  typeof linearSyntenyViewHelperModelFactory
>
export type LinearSyntenyViewHelperModel =
  Instance<LinearSyntenyViewHelperStateModel>

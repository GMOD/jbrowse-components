/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { guessTrackType } from '@jbrowse/core/util/tracks'

export default function f(pluginManager: PluginManager) {
  return types
    .model('AddTrackModel', {
      id: ElementId,
      type: types.literal('AddTrackWidget'),
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({
      trackSource: 'fromFile',
      trackData: { uri: '' } as any,
      indexTrackData: { uri: '' } as any,

      // alts
      altAssemblyName: '',
      altTrackName: '',
      altTrackType: '',

      trackAdapter: {} as any,
    }))
    .actions(self => ({
      setTrackAdapter(obj: any) {
        self.trackAdapter = obj
      },
      setTrackSource(str: string) {
        self.trackSource = str
      },
      setTrackData(obj: any) {
        self.trackData = obj
      },
      setIndexTrackData(obj: any) {
        self.indexTrackData = obj
      },
      setAssembly(str: string) {
        self.altAssemblyName = str
      },
      setTrackName(str: string) {
        self.altTrackName = str
      },
      setTrackType(str: string) {
        self.altTrackType = str
      },
    }))
    .views(self => ({
      get trackName() {
        // @ts-ignore
        const uri = self.trackData?.uri
        return (
          self.altTrackName ||
          (uri ? uri.slice(uri.lastIndexOf('/') + 1) : null)
        )
      },

      get assembly() {
        return (
          self.altAssemblyName || self.view.displayedRegions[0].assemblyName
        )
      },

      get trackType() {
        return self.altTrackType || guessTrackType(self.trackAdapter.type)
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

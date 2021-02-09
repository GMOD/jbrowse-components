/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { guessTrackType, UNSUPPORTED } from '@jbrowse/core/util/tracks'

function isAbsoluteUrl(url: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(url)
    return true
  } catch (error) {
    return url.startsWith('/')
  }
}

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

      clearData() {
        self.trackSource = ''
        self.trackAdapter = {}
        self.indexTrackData = { uri: '' }
        self.trackData = { uri: '' }
        self.altTrackName = ''
        self.altTrackType = ''
        self.altAssemblyName = ''
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

      get isFtp() {
        return (
          (self.indexTrackData.uri &&
            self.indexTrackData.uri.startsWith('ftp://')) ||
          self.trackData.uri.startsWith('ftp://')
        )
      },

      get isRelativeUrl() {
        return !(
          (self.indexTrackData.uri && isAbsoluteUrl(self.indexTrackData.uri)) ||
          isAbsoluteUrl(self.trackData.uri)
        )
      },

      get wrongProtocol() {
        return (
          window.location.protocol === 'https:' &&
          ((self.indexTrackData.uri &&
            self.indexTrackData.uri.startsWith('http://')) ||
            self.trackData.uri.startsWith('http://'))
        )
      },

      get unsupported() {
        return self.trackAdapter.type === UNSUPPORTED
      },

      get assembly() {
        return self.altAssemblyName
      },

      get trackType() {
        return self.altTrackType || guessTrackType(self.trackAdapter.type)
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import {
  guessAdapter,
  guessTrackType,
  UNSUPPORTED,
} from '@jbrowse/core/util/tracks'

function isAbsoluteUrl(url: string) {
  try {
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

      altTrackAdapter: {} as any,
    }))
    .actions(self => ({
      setTrackAdapter(obj: any) {
        self.altTrackAdapter = obj
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
        self.altTrackAdapter = {}
        self.indexTrackData = { uri: '' }
        self.trackData = { uri: '' }
        self.altTrackName = ''
        self.altTrackType = ''
        self.altAssemblyName = ''
        self.altTrackAdapter = {}
      },
    }))
    .views(self => ({
      get trackAdapter() {
        const { trackData, indexTrackData } = self
        if (trackData?.uri) {
          return guessAdapter(trackData.uri, 'uri', indexTrackData.uri)
        }

        if (trackData.localPath) {
          return guessAdapter(trackData.localPath, 'localPath')
        }
        return self.altTrackAdapter
      },

      get trackName() {
        const uri = self.trackData?.uri
        const localPath = self.trackData?.localPath
        return (
          self.altTrackName ||
          (uri ? uri.slice(uri.lastIndexOf('/') + 1) : null) ||
          (localPath ? localPath.slice(localPath.lastIndexOf('/') + 1) : null)
        )
      },

      get isFtp() {
        const { trackData, indexTrackData } = self
        return !!(
          (indexTrackData.uri && indexTrackData.uri.startsWith('ftp://')) ||
          (trackData.uri && trackData.uri.startsWith('ftp://'))
        )
      },

      get isRelativeUrl() {
        return !(
          (self.indexTrackData.uri && isAbsoluteUrl(self.indexTrackData.uri)) ||
          (self.trackData.uri && isAbsoluteUrl(self.trackData.uri))
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
        return this.trackAdapter.type === UNSUPPORTED
      },

      get assembly() {
        return self.altAssemblyName || self.view.assemblyNames?.[0]
      },

      get trackType() {
        return self.altTrackType || guessTrackType(this.trackAdapter.type)
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

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

type PreUrlLocation = { uri: string }
type PreLocalPath = { localPath: string }
type PreFileBlob = { blob: File }
type PreFileLocation = PreUrlLocation | PreLocalPath | PreFileBlob

function getFileName(track: PreFileLocation) {
  const uri = 'uri' in track ? track.uri : undefined
  const localPath = 'localPath' in track ? track.localPath : undefined
  const blob = 'blob' in track ? track.blob : undefined
  return (
    blob?.name ||
    uri?.slice(uri.lastIndexOf('/') + 1) ||
    localPath?.slice(localPath.lastIndexOf('/') + 1) ||
    ''
  )
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
      trackData: { uri: '' } as PreFileLocation,
      indexTrackData: { uri: '' } as PreFileLocation,

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
      setTrackData(obj: PreFileLocation) {
        self.trackData = obj
      },
      setIndexTrackData(obj: PreFileLocation) {
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
        self.altTrackName = ''
        self.altTrackType = ''
        self.altAssemblyName = ''
        self.altTrackAdapter = {}
        self.indexTrackData = { uri: '' }
        self.trackData = { uri: '' }
      },
    }))
    .views(self => ({
      get trackAdapter() {
        const { trackData, indexTrackData } = self

        return self.altTrackAdapter.type
          ? self.altTrackAdapter
          : guessAdapter(trackData, indexTrackData, getFileName)
      },

      get trackName() {
        return self.altTrackName || getFileName(self.trackData)
      },

      get isFtp() {
        const { trackData: track, indexTrackData: index } = self
        return !!(
          ('uri' in index && index.uri.startsWith('ftp://')) ||
          ('uri' in track && track.uri.startsWith('ftp://'))
        )
      },

      get isRelativeUrl() {
        const { trackData: track, indexTrackData: index } = self

        return 'uri' in index || 'uri' in track
          ? ('uri' in index && isAbsoluteUrl(index.uri)) ||
              ('uri' in track && isAbsoluteUrl(track.uri))
          : false
      },

      get wrongProtocol() {
        const { trackData: track, indexTrackData: index } = self
        if (window.location.protocol === 'https:') {
          return (
            ('uri' in index && index.uri.startsWith('http://')) ||
            ('uri' in track && track.uri.startsWith('http://'))
          )
        }
        return false
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
    .views(self => ({
      get warningMessage() {
        if (self.isFtp) {
          return `Warning: JBrowse cannot access files using the ftp protocol`
        } else if (self.isRelativeUrl) {
          return `Warning: one or more of your files do not provide the protocol e.g.
          https://, please provide an absolute URL unless you are sure a
          relative URL is intended.`
        } else if (self.wrongProtocol) {
          return `Warning: You entered a http:// resources but we cannot access HTTP
          resources from JBrowse when it is running on https. Please use an
          https URL for your track, or access the JBrowse app from the http
          protocol`
        }
        return ''
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

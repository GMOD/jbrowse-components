import { getSession, isUriLocation } from '@jbrowse/core/util'
import {
  UNSUPPORTED,
  getFileName,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import deepmerge from 'deepmerge'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

function getUri(location: FileLocation | undefined) {
  return isUriLocation(location) ? location.uri : undefined
}

function isRelativeUrl(url = '') {
  try {
    new URL(url)
    return false
  } catch {
    return !url.startsWith('/')
  }
}

interface IndexingAttr {
  attributes: string[]
  exclude: string[]
}

const defaultVolatileState = {
  trackData: undefined as FileLocation | undefined,
  indexTrackData: undefined as FileLocation | undefined,
  altAssemblyName: '',
  altTrackName: '',
  altTrackType: '',
  adapterHint: '',
  textIndexTrack: true,
  textIndexingConf: undefined as IndexingAttr | undefined,
  mixinData: {} as Record<string, unknown>,
}

/**
 * #stateModel AddTrackModel
 */
export default function f(pluginManager: PluginManager) {
  return types
    .model('AddTrackModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('AddTrackWidget'),
      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),
    })
    .volatile(() => ({ ...defaultVolatileState }))
    .actions(self => ({
      setMixinData(arg: Record<string, unknown>) {
        self.mixinData = arg
      },
      /**
       * #action
       */
      setAdapterHint(obj: string) {
        self.adapterHint = obj
      },
      /**
       * #action
       */
      setTextIndexingConf(conf: IndexingAttr) {
        self.textIndexingConf = conf
      },
      /**
       * #action
       */
      setTextIndexTrack(flag: boolean) {
        self.textIndexTrack = flag
      },
      /**
       * #action
       */
      setTrackData(obj: FileLocation) {
        self.trackData = obj
        // Clear adapter hint when track data changes to force re-evaluation
        self.adapterHint = ''
      },
      /**
       * #action
       */
      setIndexTrackData(obj: FileLocation) {
        self.indexTrackData = obj
        // Clear adapter hint when index data changes to force re-evaluation
        self.adapterHint = ''
      },
      /**
       * #action
       */
      setAssembly(str: string) {
        self.altAssemblyName = str
      },
      /**
       * #action
       */
      setTrackName(str: string) {
        self.altTrackName = str
      },
      /**
       * #action
       */
      setTrackType(str: string) {
        self.altTrackType = str
      },
      /**
       * #action
       */
      clearData() {
        self.altTrackName = defaultVolatileState.altTrackName
        self.altTrackType = defaultVolatileState.altTrackType
        self.altAssemblyName = defaultVolatileState.altAssemblyName
        self.adapterHint = defaultVolatileState.adapterHint
        self.indexTrackData = defaultVolatileState.indexTrackData
        self.trackData = defaultVolatileState.trackData
        self.textIndexingConf = defaultVolatileState.textIndexingConf
        self.textIndexTrack = defaultVolatileState.textIndexTrack
        self.mixinData = {}
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get trackAdapter() {
        const { trackData, indexTrackData, adapterHint } = self

        return trackData
          ? guessAdapter(trackData, indexTrackData, adapterHint, self)
          : undefined
      },

      /**
       * #getter
       */
      get trackName() {
        return (
          self.altTrackName ||
          (self.trackData ? getFileName(self.trackData) : '')
        )
      },

      /**
       * #getter
       */
      get isFtp() {
        const trackUri = getUri(self.trackData)
        const indexUri = getUri(self.indexTrackData)
        return !!(
          indexUri?.startsWith('ftp://') || trackUri?.startsWith('ftp://')
        )
      },

      /**
       * #getter
       */
      get isRelativeTrackUrl() {
        const uri = getUri(self.trackData)
        return uri ? isRelativeUrl(uri) : false
      },
      /**
       * #getter
       */
      get isRelativeIndexUrl() {
        const uri = getUri(self.indexTrackData)
        return uri ? isRelativeUrl(uri) : false
      },
      /**
       * #getter
       */
      get isRelativeUrl() {
        return this.isRelativeIndexUrl || this.isRelativeTrackUrl
      },

      /**
       * #getter
       */
      get trackHttp() {
        return getUri(self.trackData)?.startsWith('http://')
      },
      /**
       * #getter
       */
      get indexHttp() {
        return getUri(self.indexTrackData)?.startsWith('http://')
      },

      /**
       * #getter
       */
      get wrongProtocol() {
        return (
          window.location.protocol === 'https:' &&
          (this.trackHttp || this.indexHttp)
        )
      },

      /**
       * #getter
       */
      get unsupported() {
        return this.trackAdapter?.type === UNSUPPORTED
      },

      /**
       * #getter
       * Returns true if the user selected an adapter from the dropdown
       * but the extension point couldn't build a config for it
       */
      get adapterHintNotConfigurable() {
        const { adapterHint } = self
        const adapterType = this.trackAdapter?.type
        return !!(
          adapterHint &&
          (!adapterType || adapterType === 'UNKNOWN' || adapterType !== adapterHint)
        )
      },

      /**
       * #getter
       */
      get assembly() {
        return self.altAssemblyName || self.view?.assemblyNames?.[0]
      },

      /**
       * #getter
       */
      get trackAdapterType() {
        return this.trackAdapter?.type
      },
      /**
       * #getter
       */
      get trackType() {
        return (
          self.altTrackType ||
          (this.trackAdapterType
            ? guessTrackType(this.trackAdapterType, self)
            : '')
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      getTrackConfig(timestamp: number) {
        const session = getSession(self)
        const assemblyInstance = session.assemblyManager.get(self.assembly)

        return assemblyInstance &&
          self.trackAdapter &&
          self.trackAdapter.type !== 'UNKNOWN'
          ? deepmerge(
              {
                trackId: [
                  `${self.trackName.toLowerCase().replaceAll(' ', '_')}-${timestamp}`,
                  session.adminMode ? '' : '-sessionTrack',
                ].join(''),
                type: self.trackType,
                name: self.trackName,
                assemblyNames: [self.assembly],
                adapter: self.trackAdapter,
              },
              self.mixinData,
            )
          : undefined
      },
      /**
       * #getter
       */
      get warningMessage() {
        if (self.isFtp) {
          return 'Warning: JBrowse cannot access files using the ftp protocol'
        } else if (self.isRelativeUrl) {
          return `Warning: one or more of your files do not provide the protocol e.g.
          https://, please provide an absolute URL unless you are sure a
          relative URL is intended.`
        } else if (self.wrongProtocol) {
          return `Warning: You entered a http:// resources but we cannot access HTTP
          resources from JBrowse when it is running on https. Please use an
          https URL for your track, or access the JBrowse app from the http
          protocol`
        } else {
          return ''
        }
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

import {
  guessAdapter,
  guessTrackType,
  getFileName,
  UNSUPPORTED,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

function isAbsoluteUrl(url = '') {
  try {
    new URL(url)
    return true
  } catch (error) {
    return url.startsWith('/')
  }
}
interface IndexingAttr {
  attributes: string[]
  exclude: string[]
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
    .volatile(() => ({
      trackSource: 'fromFile',
      trackData: undefined as FileLocation | undefined,
      indexTrackData: undefined as FileLocation | undefined,

      // alts
      altAssemblyName: '',
      altTrackName: '',
      altTrackType: '',

      adapterHint: '',
      textIndexTrack: true,
      textIndexingConf: undefined as IndexingAttr | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAdapterHint(obj: string) {
        self.adapterHint = obj
      },
      /**
       * #action
       */
      setTrackSource(str: string) {
        self.trackSource = str
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
      },
      /**
       * #action
       */
      setIndexTrackData(obj: FileLocation) {
        self.indexTrackData = obj
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
        self.trackSource = ''
        self.altTrackName = ''
        self.altTrackType = ''
        self.altAssemblyName = ''
        self.adapterHint = ''
        self.indexTrackData = undefined
        self.trackData = undefined
        self.textIndexingConf = undefined
        self.textIndexTrack = true
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
        const { trackData: track, indexTrackData: index } = self
        return !!(
          // @ts-expect-error
          (index?.uri?.startsWith('ftp://') || track?.uri?.startsWith('ftp://'))
        )
      },

      /**
       * #getter
       */
      get isRelativeTrackUrl() {
        // @ts-expect-error
        const uri = self.trackData?.uri
        return uri ? !isAbsoluteUrl(uri) : false
      },
      /**
       * #getter
       */
      get isRelativeIndexUrl() {
        // @ts-expect-error
        const uri = self.indexTrackData?.uri
        return uri ? !isAbsoluteUrl(uri) : false
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
        // @ts-expect-error
        return self.trackData?.uri?.startsWith('http://')
      },
      /**
       * #getter
       */
      get indexHttp() {
        // @ts-expect-error
        return self.indexTrackData?.uri?.startsWith('http://')
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
       */
      get assembly() {
        return self.altAssemblyName || self.view.assemblyNames?.[0]
      },

      /**
       * #getter
       */
      get trackType() {
        return (
          self.altTrackType ||
          (this.trackAdapter
            ? guessTrackType(this.trackAdapter.type, self)
            : '')
        )
      },
    }))
    .views(self => ({
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
        }
        return ''
      },
    }))
}

export type AddTrackStateModel = ReturnType<typeof f>
export type AddTrackModel = Instance<AddTrackStateModel>

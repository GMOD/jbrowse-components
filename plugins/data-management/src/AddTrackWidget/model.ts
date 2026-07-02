import { getSession, isUriLocation, makeTrackId } from '@jbrowse/core/util'
import {
  UNKNOWN,
  UNSUPPORTED,
  getFileName,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import deepmerge from 'deepmerge'
import { reaction } from 'mobx'

import {
  isBlockedHttpUrl,
  isFtpUrl,
  isRelativeUrl as isRelativeUrlString,
} from './urlWarnings.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

function getUri(location: FileLocation | undefined) {
  return isUriLocation(location) ? location.uri : undefined
}

export interface IndexingAttr {
  attributes: string[]
  exclude: string[]
}

// A factory (not a shared const) so each model instance — and each clearData
// call — gets its own fresh mixinData object rather than aliasing one shared
// reference.
function createVolatileState() {
  return {
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
}

/**
 * #stateModel AddTrackModel
 * #category widget
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
    .volatile(() => createVolatileState())
    .actions(self => ({
      /**
       * #action
       */
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
        Object.assign(self, createVolatileState())
      },
    }))
    .actions(self => ({
      afterAttach() {
        // The widget instance is reused (reconciled) across opens because it
        // is keyed by a fixed id in session.widgets. Reopening it for a
        // different view updates self.view but leaves the previously entered
        // form data — including altAssemblyName — in place, which would add
        // the track to the wrong assembly. Reset the form when the target
        // view changes.
        addDisposer(
          self,
          reaction(
            () => self.view?.id,
            () => {
              self.clearData()
            },
          ),
        )
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
      get uris() {
        return [getUri(self.trackData), getUri(self.indexTrackData)]
      },
      /**
       * #getter
       */
      get isFtp() {
        return this.uris.some(isFtpUrl)
      },

      /**
       * #getter
       */
      get isRelativeTrackUrl() {
        const uri = getUri(self.trackData)
        return uri ? isRelativeUrlString(uri) : false
      },
      /**
       * #getter
       */
      get isRelativeIndexUrl() {
        const uri = getUri(self.indexTrackData)
        return uri ? isRelativeUrlString(uri) : false
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
      get wrongProtocol() {
        return this.uris.some(isBlockedHttpUrl)
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
        return !!(adapterHint && this.trackAdapter?.type !== adapterHint)
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
            ? guessTrackType(this.trackAdapterType, self, self.trackData)
            : '')
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackConfig(timestamp: number) {
        const session = getSession(self)
        const assemblyInstance = session.assemblyManager.get(self.assembly)

        return assemblyInstance &&
          self.trackAdapter &&
          self.trackAdapter.type !== UNKNOWN
          ? deepmerge(
              {
                trackId: makeTrackId({
                  name: self.trackName,
                  timestamp,
                  adminMode: !!session.adminMode,
                }),
                type: self.trackType,
                name: self.trackName,
                assemblyNames: [self.assembly],
                adapter: { ...self.trackAdapter },
              },
              // Synteny add-track components seed mixinData.adapter with the
              // query/target assemblies; non-synteny tracks leave it empty so
              // their adapter config isn't polluted with assembly-pair fields.
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

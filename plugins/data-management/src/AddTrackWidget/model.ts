import { getSession, isUriLocation, makeTrackId } from '@jbrowse/core/util'
import { detectIndexLocation } from '@jbrowse/core/util/indexCandidates'
import { openLocation } from '@jbrowse/core/util/io'
import {
  UNKNOWN,
  getFileName,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import deepmerge from 'deepmerge'
import { autorun } from 'mobx'

import {
  isBlockedHttpUrl,
  isFtpUrl,
  isRelativeUrl as isRelativeUrlString,
} from './urlWarnings.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackContainer } from '@jbrowse/core/util'
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
    // The filename of an index this widget found beside the main file, so the
    // form can say the field was filled in for you rather than leaving a path
    // you did not type looking like one you did. Cleared the moment you set an
    // index yourself.
    detectedIndexName: undefined as string | undefined,
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
      /**
       * #property
       * Which of the view's track containers the new track opens in, by id.
       * Absent — the usual case — means the view itself. See the same property
       * on HierarchicalTrackSelectorWidget, which is what sets this.
       */
      trackContainerId: types.maybe(types.string),
    })
    .volatile(() => createVolatileState())
    .views(self => ({
      /**
       * #getter
       * The track list a submitted track opens in.
       */
      get trackContainer(): TrackContainer | undefined {
        const { view, trackContainerId } = self
        return trackContainerId === undefined
          ? view
          : view?.trackContainerFor?.(trackContainerId)
      },
    }))
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
        // a detection belongs to the file it was made against, so a new main
        // file drops both the note and the index it filled in
        if (self.detectedIndexName !== undefined) {
          self.detectedIndexName = undefined
          self.indexTrackData = undefined
        }
      },
      /**
       * #action
       */
      setIndexTrackData(obj: FileLocation) {
        self.indexTrackData = obj
        // Clear adapter hint when index data changes to force re-evaluation
        self.adapterHint = ''
        // typed by hand, so it is no longer this widget's guess to explain
        self.detectedIndexName = undefined
      },
      /**
       * #action
       * Records an index found beside the main file. Ignored when an index is
       * already set, since a probe resolving late must never overwrite one
       * typed while it was in flight.
       */
      setDetectedIndex(obj: FileLocation, name: string) {
        if (!self.indexTrackData) {
          self.indexTrackData = obj
          self.detectedIndexName = name
          self.adapterHint = ''
        }
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
    .actions(self => {
      // where a submitted track would land: the view, and the track list within
      // it. Two levels of one synteny view are different targets sharing a view
      // id, so both halves matter.
      function targetKey() {
        return `${self.view?.id}-${self.trackContainerId}`
      }
      return {
        afterAttach() {
          // The widget instance is reused (reconciled) across opens because it
          // is keyed by a fixed id in session.widgets. Reopening it for a
          // different target leaves the previously entered form data —
          // including altAssemblyName — in place, which would add the track to
          // the wrong assembly.
          //
          // `lastTarget` seeds from the target the widget attached with, so the
          // autorun's first pass is a no-op — clearing there would wipe form
          // state legitimately restored from the session.
          let lastTarget = targetKey()
          addDisposer(
            self,
            autorun(() => {
              const target = targetKey()
              if (target !== lastTarget) {
                lastTarget = target
                self.clearData()
              }
            }),
          )

          // Fill the index field from whatever is actually beside the main
          // file. The guess it replaces is a bare `<file>.bai`/`.tbi` append
          // (makeIndex), so a `.csi` or a Picard-style `reads.bai` — both
          // ordinary htslib output — produced a track that failed on a path
          // nobody typed.
          //
          // The probe reads a location, which costs a request for a URL, so it
          // runs only when there is no index yet and only for a file type that
          // has one. A Blob gets no candidates at all: a file picked out of a
          // browser dialog has no directory to look in.
          addDisposer(
            self,
            autorun(() => {
              // read inside the autorun body, not through an action, or the
              // dependency is never recorded
              const { trackData, indexTrackData } = self
              if (!trackData || indexTrackData) {
                return
              }
              // captured so a probe that resolves after the user has moved to
              // another file cannot write the wrong answer into the form
              const probedFor = trackData
              detectIndexLocation(trackData, async location => {
                try {
                  await openLocation(location, pluginManager).stat()
                  return true
                } catch {
                  return false
                }
              })
                .then(found => {
                  if (found && self.trackData === probedFor) {
                    self.setDetectedIndex(found, getFileName(found))
                  }
                })
                .catch(() => {
                  // a probe that cannot run is not a failure the user needs
                  // told about: the conventional guess still applies, and it is
                  // what they got before this existed
                })
            }),
          )
        },
      }
    })
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
      get isRelativeUrl() {
        // isRelativeUrlString('') is true, so skip empty/undefined uris that
        // getUri returns for non-URI (e.g. local file) locations
        return this.uris.some(uri => !!uri && isRelativeUrlString(uri))
      },

      /**
       * #getter
       */
      get wrongProtocol() {
        return this.uris.some(isBlockedHttpUrl)
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
        return self.altAssemblyName || self.trackContainer?.assemblyNames?.[0]
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
        const assemblyInstance = self.assembly
          ? session.assemblyManager.get(self.assembly)
          : undefined

        return assemblyInstance &&
          self.trackAdapter &&
          self.trackAdapter.type !== UNKNOWN
          ? deepmerge(
              {
                trackId: makeTrackId({
                  name: self.trackName,
                  timestamp,
                }),
                type: self.trackType,
                name: self.trackName,
                assemblyNames: [self.assembly],
                adapter: { ...self.trackAdapter },
              },
              // Synteny add-track components seed mixinData with the assemblies
              // the file covers — on the adapter, and on the track itself, since
              // the track selector only offers a track that lists every assembly
              // the view displays (filterTracks). Non-synteny tracks leave it
              // empty so their config isn't polluted with assembly-pair fields.
              self.mixinData,
              // a contributed array replaces the base one rather than
              // concatenating onto it, so a multi-genome track's assemblyNames
              // doesn't come back as [thisAssembly, ...allAssemblies]
              { arrayMerge: (_base, contributed: unknown[]) => contributed },
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

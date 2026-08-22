import fs from 'node:fs'
import path from 'node:path'

import {
  formatBytes,
  statusFraction,
  statusMessageText,
  statusReading,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, getParent, types } from '@jbrowse/mobx-state-tree'
import { getOrCreateJobsListWidget } from '@jbrowse/plugin-jobs-management'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing'
import { autorun, observable, toJS } from 'mobx'

import { NAME_INDICES_DIR } from '../electron/ipc/channelTypes.ts'
import { invokeIpc } from './ipc.ts'

import type { DesktopRootModel } from './rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { RpcStatus, SessionWithDrawerWidgets } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends } from '@jbrowse/product-core'
import type { indexType } from '@jbrowse/text-indexing'
import type { Track } from '@jbrowse/text-indexing-core'

// The jobs manager lives at rootModel.jobsManager, so its MST parent is the root
// model; this is the slice it reaches for. One typed contract in place of the
// per-getter getParent<{...}> shapes, mirroring the react session models'
// SessionModelParent.
export interface JobsManagerParent {
  jbrowse: {
    rpcManager: RpcManager
    tracks: Track[]
    aggregateTextSearchAdapters: { textSearchAdapterId: string }[]
  }
  session: SessionWithDrawerWidgets
  textSearchManager: { clearCache: () => void }
}

// Compile-time guard: the real root model must actually provide everything
// JobsManagerParent claims. getParent<JobsManagerParent> is an unchecked
// assertion, so without this the shadow could silently drift from the root
// (e.g. a renamed rpcManager) and only surface at runtime. If this errors, the
// shadow above claims something rootModel no longer provides.
//
// It covers `jbrowse` and `textSearchManager` and NOT `session`, which it
// cannot check at all: BaseRootModel declares `session` against the erased
// `IAnyType` to avoid a root<->session cycle, so `DesktopRootModel['session']`
// is `any` and any shape whatsoever satisfies this assert. Two things follow.
// The declared `SessionWithDrawerWidgets` is a statement of what this file uses
// rather than a checked fact — verify it against sessionModel.ts by hand. And
// it hides that the real prop is `types.maybe`: every other desktop reader of
// `rootModel.session` handles undefined, and this file is the one that does
// not. That is deliberate, not an oversight — no action here is reachable
// before pluginManagers.tsx sets the session, because `jobsQueue` is volatile
// and so never arrives pre-populated from a snapshot.
export type _JobsManagerParentCheck = AssertExtends<
  DesktopRootModel,
  JobsManagerParent
>

interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: indexType
}

export interface TextJobsEntry {
  name: string
  statusMessage?: string
  indexingParams: TrackTextIndexing
}

// Both conf writers are plain functions rather than actions on the model: they
// are called from inside `runIndexingJob`, and MST's action context is the call
// stack, so the writes are still inside one.
function addTrackTextSearchConf(
  tracks: Track[],
  {
    trackId,
    assemblies,
    attributes,
    exclude,
    outLocation,
  }: {
    trackId: string
    assemblies: string[]
    attributes: string[]
    exclude: string[]
    outLocation: string
  },
) {
  const track = tracks.find(t => trackId === t.trackId)
  if (track) {
    track.textSearching = {
      textSearchAdapter: createTextSearchConf(
        `${trackId}-index`,
        [trackId],
        assemblies,
        outLocation,
      ),
      indexingAttributes: attributes,
      indexingFeatureTypesToExclude: exclude,
    }
  }
}

function addAggregateTextSearchConf(
  adapters: { textSearchAdapterId: string }[],
  {
    trackIds,
    assemblyName,
    outLocation,
  }: { trackIds: string[]; assemblyName: string; outLocation: string },
) {
  const id = `${assemblyName}-index`
  const trixConf = createTextSearchConf(
    id,
    trackIds,
    [assemblyName],
    outLocation,
  )
  const foundIdx = adapters.findIndex(x => x.textSearchAdapterId === id)
  if (foundIdx === -1) {
    adapters.push(trixConf)
  } else {
    adapters[foundIdx] = trixConf
  }
}

// the byte counts behind the fraction: a percentage alone doesn't say whether
// the rest is seconds or minutes
function statusText(status: RpcStatus) {
  const message = statusMessageText(status) ?? ''
  const reading = statusReading(status)
  if (reading === undefined) {
    return message
  }
  const counts =
    reading.total > 0
      ? `${formatBytes(reading.current)} / ${formatBytes(reading.total)}`
      : formatBytes(reading.current)
  return message ? `${message}: ${counts}` : counts
}

/**
 * #stateModel JobsManager
 * #internal desktop text-indexing queue internals — kept out of the website docs
 * Desktop text-indexing job queue: tracks the running job with its progress and
 * status message, plus the list of queued indexing jobs.
 */
export default function jobsModelFactory(_pluginManager: PluginManager) {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      /**
       * #volatile
       */
      running: false,
      /**
       * #volatile
       * stop token for the currently running RPC indexing job, used to cancel
       */
      stopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       * set when the user cancels, so the catch block reports a cancellation
       * rather than an error
       */
      aborted: false,
      /**
       * #volatile
       */
      jobsQueue: observable.array<TextJobsEntry>([]),
    }))
    .views(self => ({
      /**
       * #getter
       */
      get root() {
        return getParent<JobsManagerParent>(self)
      },
      /**
       * #getter
       */
      get rpcManager() {
        return this.root.jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get tracks() {
        return this.root.jbrowse.tracks
      },
      /**
       * #getter
       */
      get session() {
        return this.root.session
      },
      /**
       * #getter
       */
      get aggregateTextSearchAdapters() {
        return this.root.jbrowse.aggregateTextSearchAdapters
      },
    }))
    .actions(self => ({
      /**
       * #method
       * No isSessionModelWithWidgets guard, here or in the callers. The desktop
       * session always has widgets (asserted in sessionModel.ts), and the guard
       * cannot detect the case it looks like it covers: `'rpcManager' in node`
       * is still true after a destroy, so it returns true for a dead session —
       * and `self.session` is a getParent hop, which throws on a dead node
       * before the guard would run anyway.
       */
      getJobStatusWidget() {
        return getOrCreateJobsListWidget(self.session)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRunning(running: boolean) {
        self.running = running
      },
      /**
       * #action
       */
      setStopToken(token?: StopToken) {
        self.stopToken = token
      },
      /**
       * #action
       * cancel the currently running indexing job; the RPC throws 'aborted',
       * handled in runIndexingJob's catch
       */
      abortJob() {
        self.aborted = true
        stopStopToken(self.stopToken)
      },
      /**
       * #action
       * The job card is the only copy of the message and the fraction; this
       * model kept a second one that nothing outside it read.
       */
      reportStatus(jobName: string, status: RpcStatus) {
        const fraction = statusFraction(status)
        self
          .getJobStatusWidget()
          .updateJobStatus(
            jobName,
            statusText(status),
            fraction === undefined ? undefined : fraction * 100,
          )
      },

      /**
       * #action
       */
      queueJob(props: TextJobsEntry) {
        const jobStatusWidget = self.getJobStatusWidget()
        self.session.showWidget(jobStatusWidget)
        jobStatusWidget.addJob({
          name: props.name,
          state: 'queued',
          statusMessage: props.statusMessage,
          progressPct: undefined,
        })
        self.jobsQueue.push(props)
      },
      /**
       * #action
       */
      clear() {
        this.setRunning(false)
        // stop before dropping the reference: this runs after every job, and a
        // job that *succeeded* was never stopped by `abortJob`, so dropping it
        // here leaks the blob URL and any AbortControllers taken against it —
        // one per indexing run, for the life of the window. Idempotent on the
        // cancelled path, where abortJob already stopped it.
        stopStopToken(self.stopToken)
        self.stopToken = undefined
        self.aborted = false
      },
      /**
       * #action
       */
      async runIndexingJob(entry: TextJobsEntry) {
        const { session } = self
        const {
          tracks: trackIds,
          exclude,
          attributes,
          assemblies,
          indexType,
        } = toJS(entry.indexingParams)
        const rpcManager = self.rpcManager
        const stopToken = createStopToken()
        this.setStopToken(stopToken)
        // `aborted` is only cleared by clear(), so a flag standing here was set
        // against a queue this entry was already in. Without the stop the entry
        // ran the full index and was then merely *reported* as cancelled
        if (self.aborted) {
          stopStopToken(stopToken)
        }
        try {
          this.setRunning(true)
          // resolve configs inside the try: a since-deleted track makes
          // findTrackConfigsToIndex throw, and doing it here dequeues the job in
          // the catch rather than looping the autorun on the stuck queue entry
          const trackConfigs = findTrackConfigsToIndex(
            self.tracks,
            trackIds,
          ).map(c => toJS(c))
          const userData = await invokeIpc('userData')
          const outLocation = path.join(
            userData,
            NAME_INDICES_DIR,
            `trix-${Date.now()}`,
          )
          fs.mkdirSync(outLocation, { recursive: true })
          await rpcManager.call('indexTracksSessionId', 'TextIndexRpcMethod', {
            tracks: trackConfigs,
            attributes,
            exclude,
            assemblies,
            indexType,
            outLocation,
            stopToken,
            statusCallback: status => {
              this.reportStatus(entry.name, status)
            },
          })
          if (indexType === 'perTrack') {
            // iterate the configs that were actually indexed, not the raw
            // requested trackIds: a track filtered out for an unsupported
            // adapter (or since-deleted) must not get a "success" notice and a
            // textSearchAdapter config pointing at an .ix that was never written
            for (const { trackId } of trackConfigs) {
              addTrackTextSearchConf(self.tracks, {
                trackId,
                assemblies,
                attributes,
                exclude,
                outLocation,
              })
              session.notify(
                `Successfully indexed track with trackId: ${trackId} `,
                'success',
              )
            }
          } else {
            for (const assemblyName of assemblies) {
              const indexedTrackIds = trackConfigs
                .filter(track => track.assemblyNames.includes(assemblyName))
                .map(trackConf => trackConf.trackId)
              addAggregateTextSearchConf(self.aggregateTextSearchAdapters, {
                trackIds: indexedTrackIds,
                assemblyName,
                outLocation,
              })

              session.notify(
                `Successfully indexed assembly: ${assemblyName} `,
                'success',
              )
            }
          }

          // clear the text search adapter cache so stale adapters pointing
          // at old index files are discarded
          self.root.textSearchManager.clearCache()
          self.jobsQueue.shift()
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          jobStatusWidget.addJob({
            name: entry.name,
            state: 'finished',
            statusMessage: 'Done',
            progressPct: undefined,
          })
        } catch (e) {
          if (self.aborted) {
            session.notify(`Cancelled indexing job: ${entry.name}`, 'info')
          } else {
            console.error(e)
            session.notifyError(
              `An error occurred while indexing: ${e}`,
              e,
              undefined,
              {
                name: 'Retry',
                onClick: () => {
                  // a plain snapshot; the shift below drops `entry` from the
                  // observable queue
                  this.queueJob(toJS(entry))
                },
              },
            )
          }
          self.jobsQueue.shift()
          self.getJobStatusWidget().addJob({
            name: entry.name,
            state: 'aborted',
            statusMessage: self.aborted ? 'Cancelled' : `${e}`,
            progressPct: undefined,
          })
        }
        // clear
        this.clear()
      },

      /**
       * #action
       */
      async runJob() {
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0]!
          const jobStatusWidget = self.getJobStatusWidget()
          self.session.showWidget(jobStatusWidget)
          jobStatusWidget.addJob({
            name: firstIndexingJob.name,
            state: 'running',
            statusMessage: firstIndexingJob.statusMessage,
            cancelCallback: () => {
              this.abortJob()
            },
          })
          await this.runIndexingJob(firstIndexingJob)
        }
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(
            async () => {
              try {
                if (self.jobsQueue.length > 0 && !self.running) {
                  await this.runJob()
                }
              } catch (e) {
                console.error(e)
                self.session.notifyError(`${e}`, e)
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type JobsStateModel = Instance<ReturnType<typeof jobsModelFactory>>

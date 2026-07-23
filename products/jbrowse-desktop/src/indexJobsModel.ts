import fs from 'node:fs'
import path from 'node:path'

import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, getParent, types } from '@jbrowse/mobx-state-tree'
import { getOrCreateJobsListWidget } from '@jbrowse/plugin-jobs-management'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing'
import { autorun, observable, toJS } from 'mobx'

import type { DesktopRootModel } from './rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends } from '@jbrowse/product-core'
import type { Track, indexType } from '@jbrowse/text-indexing'

const { ipcRenderer } = window.require('electron')

// The jobs manager lives at rootModel.jobsManager, so its MST parent is the root
// model; this is the slice it reaches for. One typed contract in place of the
// per-getter getParent<{...}> shapes, mirroring the react session models'
// SessionModelParent.
interface JobsManagerParent {
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
  timestamp?: string
  name?: string
}

interface JobsEntry {
  name: string
  statusMessage?: string
}
export interface TextJobsEntry extends JobsEntry {
  indexingParams: TrackTextIndexing
}

function formatBytes(bytes: number) {
  const units = ['bytes', 'kB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`
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
       */
      statusMessage: '',
      /**
       * #volatile
       */
      jobName: '',
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
      get rpcManager() {
        return getParent<JobsManagerParent>(self).jbrowse.rpcManager
      },
      /**
       * #getter
       */
      get tracks() {
        return getParent<JobsManagerParent>(self).jbrowse.tracks
      },
      /**
       * #getter
       */
      get session() {
        return getParent<JobsManagerParent>(self).session
      },
      /**
       * #getter
       */
      get aggregateTextSearchAdapters() {
        return getParent<JobsManagerParent>(self).jbrowse
          .aggregateTextSearchAdapters
      },
    }))
    .actions(self => ({
      /**
       * #method
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
      setJobName(name: string) {
        self.jobName = name
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
       */
      reportStatus(arg: string) {
        // the worker reports byte progress as "received/total"; anything else
        // is already a human-readable status message. show the raw byte counts
        // rather than a percentage: the percentage only covers the read phase
        // and would sit at 100% during the (often long) ixIxx generation
        const slash = arg.indexOf('/')
        if (slash === -1) {
          this.setStatusMessage(arg)
        } else {
          const received = +arg.slice(0, slash)
          const total = +arg.slice(slash + 1)
          this.setStatusMessage(
            total > 0
              ? `Indexed ${formatBytes(received)} / ${formatBytes(total)}`
              : `Indexed ${formatBytes(received)}`,
          )
        }
        this.setWidgetStatus()
      },

      /**
       * #action
       */
      setWidgetStatus() {
        if (isSessionModelWithWidgets(self.session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          jobStatusWidget.updateJobStatusMessage(
            self.jobName,
            self.statusMessage,
          )
        }
      },

      /**
       * #action
       */
      setStatusMessage(arg: string) {
        self.statusMessage = arg
      },

      /**
       * #action
       */
      queueJob(props: TextJobsEntry) {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          session.showWidget(jobStatusWidget)
          const { name, statusMessage = '' } = props
          jobStatusWidget.addQueuedJob({ name, statusMessage })
        }
        self.jobsQueue.push(props)
      },
      /**
       * #action
       */
      dequeueJob() {
        const { session } = self
        if (isSessionModelWithWidgets(session)) {
          const jobStatusWidget = self.getJobStatusWidget()
          jobStatusWidget.removeJob(self.jobName)
        }
        return self.jobsQueue.shift()
      },
      /**
       * #action
       */
      clear() {
        this.setRunning(false)
        this.setStatusMessage('')
        this.setJobName('')
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
        try {
          this.setRunning(true)
          this.setJobName(entry.name)
          // resolve configs inside the try: a since-deleted track makes
          // findTrackConfigsToIndex throw, and doing it here dequeues the job in
          // the catch rather than looping the autorun on the stuck queue entry
          const trackConfigs = findTrackConfigsToIndex(
            self.tracks,
            trackIds,
          ).map(c => toJS(c))
          const userData = await ipcRenderer.invoke('userData')
          const outLocation = path.join(
            userData,
            'nameIndices',
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
            statusCallback: (message: string) => {
              this.reportStatus(message)
            },
          })
          if (indexType === 'perTrack') {
            // iterate the configs that were actually indexed, not the raw
            // requested trackIds: a track filtered out for an unsupported
            // adapter (or since-deleted) must not get a "success" notice and a
            // textSearchAdapter config pointing at an .ix that was never written
            for (const { trackId } of trackConfigs) {
              this.addTrackTextSearchConf({
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
              this.addAggregateTextSearchConf({
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
          const rootModel = getParent<JobsManagerParent>(self)
          rootModel.textSearchManager.clearCache()
          // remove from the queue and add to finished/completed jobs
          const current = this.dequeueJob()
          if (current && isSessionModelWithWidgets(session)) {
            const jobStatusWidget = self.getJobStatusWidget()
            session.showWidget(jobStatusWidget)
            jobStatusWidget.addFinishedJob({
              name: current.name,
              statusMessage: current.statusMessage ?? 'done',
            })
          }
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
                  // re-queue a plain snapshot; `entry` was detached from the
                  // observable queue by dequeueJob below
                  this.queueJob(toJS(entry))
                },
              },
            )
          }
          const failed = this.dequeueJob()
          if (failed && isSessionModelWithWidgets(session)) {
            self.getJobStatusWidget().addAbortedJob({
              name: failed.name,
              statusMessage: self.aborted ? 'Cancelled' : `${e}`,
            })
          }
        }
        // clear
        this.clear()
      },

      /**
       * #action
       */
      async runJob() {
        const { session } = self
        if (self.jobsQueue.length) {
          const firstIndexingJob = self.jobsQueue[0]!
          if (isSessionModelWithWidgets(session)) {
            const jobStatusWidget = self.getJobStatusWidget()
            session.showWidget(jobStatusWidget)
            const { name, statusMessage } = firstIndexingJob
            jobStatusWidget.addJob({
              name,
              statusMessage: statusMessage ?? '',
              cancelCallback: () => {
                this.abortJob()
              },
            })
            jobStatusWidget.removeQueuedJob(name)
          }
          await this.runIndexingJob(firstIndexingJob)
        }
      },
      /**
       * #action
       */
      addTrackTextSearchConf({
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
      }) {
        const track = self.tracks.find(t => trackId === t.trackId)
        if (track) {
          const id = `${trackId}-index`
          const adapterConf = createTextSearchConf(
            id,
            [trackId],
            assemblies,
            outLocation,
          )
          track.textSearching = {
            textSearchAdapter: adapterConf,
            indexingAttributes: attributes,
            indexingFeatureTypesToExclude: exclude,
          }
        }
      },
      /**
       * #action
       */
      addAggregateTextSearchConf({
        trackIds,
        assemblyName,
        outLocation,
      }: {
        trackIds: string[]
        assemblyName: string
        outLocation: string
      }) {
        const id = `${assemblyName}-index`
        const foundIdx = self.aggregateTextSearchAdapters.findIndex(
          x => x.textSearchAdapterId === id,
        )
        const trixConf = createTextSearchConf(
          id,
          trackIds,
          [assemblyName],
          outLocation,
        )
        if (foundIdx === -1) {
          self.aggregateTextSearchAdapters.push(trixConf)
        } else {
          self.aggregateTextSearchAdapters[foundIdx] = trixConf
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

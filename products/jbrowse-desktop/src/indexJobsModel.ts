import fs from 'node:fs'
import path from 'node:path'

import {
  formatBytes,
  statusFraction,
  statusMessageText,
  statusReading,
} from '@jbrowse/core/util'
import {
  addDisposer,
  getParent,
  getSnapshot,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'
import { getOrCreateJobsListWidget } from '@jbrowse/plugin-jobs-management'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from '@jbrowse/text-indexing/util'
import { autorun, observable, toJS } from 'mobx'

import { NAME_INDICES_DIR } from '../electron/ipc/channelTypes.ts'
import { invokeIpc } from './ipc.ts'

import type { DesktopRootModel } from './rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { RpcStatus, SessionWithDrawerWidgets } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends } from '@jbrowse/product-core'
import type { Track } from '@jbrowse/text-indexing-core'
import type { indexType } from '@jbrowse/text-indexing/util'

// The jobs manager lives at rootModel.jobsManager, so its MST parent is the root
// model; this is the slice it reaches for. One typed contract in place of the
// per-getter getParent<{...}> shapes, mirroring the react session models'
// SessionModelParent.
export interface JobsManagerParent {
  jbrowse: {
    rpcManager: RpcManager
    aggregateTextSearchAdapters: AggregateEntry[]
  }
  session: SessionWithDrawerWidgets & { trackBasesById: Map<string, Track> }
  updateTrackBase: (trackConf: {
    trackId: string
    [key: string]: unknown
  }) => void
}

// getParent<JobsManagerParent> is unchecked, so this fails the build when the
// root stops providing what the shadow claims. It cannot check `session`, which
// BaseRootModel declares against IAnyType: those members are checked by hand
// against sessionModel.ts, and no action here runs before a session is set.
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

// A new conf rather than a mutation of the base: a displayed track's hydration
// cache (ADR-031) is keyed by the base object's identity, so a write in place
// stays invisible to it and to TextSearchManager.
function indexedTrackConf(
  track: Track,
  {
    assemblies,
    attributes,
    exclude,
    outLocation,
  }: {
    assemblies: string[]
    attributes: string[]
    exclude: string[]
    outLocation: string
  },
) {
  return {
    ...track,
    textSearching: {
      ...track.textSearching,
      textSearchAdapter: createTextSearchConf(
        `${track.trackId}-index`,
        assemblies,
        outLocation,
      ),
      indexingAttributes: attributes,
      indexingFeatureTypesToExclude: exclude,
    },
  }
}

type TextSearchConf = ReturnType<typeof createTextSearchConf>
type AggregateEntry = AnyConfigurationModel | TextSearchConf

// an assembly's aggregate index is the trix covering it alone, whoever wrote
// it, so a re-index replaces a CLI-built one as well as its own last run
function isAggregateIndexOf(entry: AggregateEntry, assemblyName: string) {
  const { type, assemblyNames } = (
    isStateTreeNode(entry) ? getSnapshot(entry) : entry
  ) as Partial<TextSearchConf>
  return (
    type === 'TrixTextSearchAdapter' &&
    assemblyNames?.length === 1 &&
    assemblyNames[0] === assemblyName
  )
}

function addAggregateTextSearchConf(
  adapters: AggregateEntry[],
  { assemblyName, outLocation }: { assemblyName: string; outLocation: string },
) {
  const trixConf = createTextSearchConf(
    `${assemblyName}-index`,
    [assemblyName],
    outLocation,
  )
  const foundIdx = adapters.findIndex(x => isAggregateIndexOf(x, assemblyName))
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
       * aborted to cancel the currently running RPC indexing job
       */
      controller: undefined as AbortController | undefined,
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
       * Each track's base: its sessionTracks entry, else its config.json entry
       */
      get tracks() {
        return [...this.root.session.trackBasesById.values()]
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
      setController(controller?: AbortController) {
        self.controller = controller
      },
      /**
       * #action
       * cancel the currently running indexing job; the RPC throws 'aborted',
       * handled in runIndexingJob's catch
       */
      abortJob() {
        self.aborted = true
        self.controller?.abort()
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
      dequeue() {
        self.jobsQueue.shift()
      },
      /**
       * #action
       */
      clear() {
        this.setRunning(false)
        self.controller = undefined
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
        const controller = new AbortController()
        this.setController(controller)
        // `aborted` is only cleared by clear(), so a flag standing here was set
        // against a queue this entry was already in. Without the stop the entry
        // ran the full index and was then merely *reported* as cancelled
        if (self.aborted) {
          controller.abort()
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
            policy: { attributes, exclude },
            assemblies,
            indexType,
            outLocation,
            signal: controller.signal,
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
              // re-found now, not the pre-RPC trackConfigs entry: indexing ran
              // for minutes, and writing that stale copy back would revert any
              // edit made to the track while it was indexing
              const current = self.session.trackBasesById.get(trackId)
              if (current) {
                self.root.updateTrackBase(
                  indexedTrackConf(current, {
                    assemblies,
                    attributes,
                    exclude,
                    outLocation,
                  }),
                )
              }
              session.notify(
                `Successfully indexed track with trackId: ${trackId} `,
                'success',
              )
            }
          } else {
            for (const assemblyName of assemblies) {
              addAggregateTextSearchConf(self.aggregateTextSearchAdapters, {
                assemblyName,
                outLocation,
              })

              session.notify(
                `Successfully indexed assembly: ${assemblyName} `,
                'success',
              )
            }
          }

          this.dequeue()
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
          this.dequeue()
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

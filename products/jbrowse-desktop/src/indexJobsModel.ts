import path from 'node:path'

import { getOrCreateJobsListWidget } from '@jbrowse/app-core'
import {
  formatBytes,
  statusFraction,
  statusMessageText,
  statusReading,
} from '@jbrowse/core/util'
import { getParent, isAlive, types } from '@jbrowse/mobx-state-tree'
import { observable, toJS } from 'mobx'

import { NAME_INDICES_DIR } from '../electron/ipc/channelTypes.ts'
import {
  createTextSearchConf,
  findTrackConfigsToIndex,
} from './TextIndexing/textSearchConf.ts'
import { invokeIpc } from './ipc.ts'

import type { DesktopRootModel } from './rootModel/rootModel.ts'
import type { TrackConfigEntry } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { RpcStatus, SessionWithDrawerWidgets } from '@jbrowse/core/util'
import type { AssertExtends } from '@jbrowse/product-core'
import type { Track } from '@jbrowse/text-indexing-core'

// the slice of the root model (this manager's MST parent) that it reaches for
export interface JobsManagerParent {
  jbrowse: {
    rpcManager: RpcManager
  }
  session?: SessionWithDrawerWidgets & {
    trackBasesById: Map<string, TrackConfigEntry>
  }
  updateTrackBase: (trackConf: {
    trackId: string
    [key: string]: unknown
  }) => void
}

// getParent<JobsManagerParent> is unchecked, so this fails the build when the
// root stops providing what the shadow claims.
export type _JobsManagerParentCheck = AssertExtends<
  DesktopRootModel,
  JobsManagerParent
>

// one track per job, so the trackId doubles as the job's name on its card
export interface TextJobsEntry {
  trackId: string
  label?: string
  attributes: string[]
  exclude?: string[]
  assemblies: string[]
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
    exclude?: string[]
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
      ...(exclude ? { indexingFeatureTypesToExclude: exclude } : {}),
    },
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
 * Desktop text-indexing job queue: indexes one track at a time and reports
 * each job's progress to the Jobs list widget.
 */
export default function jobsModelFactory() {
  return types
    .model('JobsManager', {})
    .volatile(() => ({
      /**
       * #volatile
       * the running job's; aborting it cancels the RPC
       */
      controller: undefined as AbortController | undefined,
      /**
       * #volatile
       * the head is the running job until it finishes
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
        return [...this.session.trackBasesById.values()]
      },
      /**
       * #getter
       */
      get session() {
        const { session } = this.root
        if (!session) {
          throw new Error('no session is open')
        }
        return session
      },
    }))
    .actions(self => ({
      /**
       * #method
       * Unguarded: the desktop session always has widgets (asserted in
       * sessionModel.ts), and isSessionModelWithWidgets answers true for a
       * destroyed session anyway.
       */
      getJobStatusWidget() {
        return getOrCreateJobsListWidget(self.session)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setController(controller?: AbortController) {
        self.controller = controller
      },
      /**
       * #action
       */
      dequeue() {
        self.jobsQueue.shift()
      },
      /**
       * #action
       * Aborts the job if it is running, else takes it out of the queue.
       */
      cancelJob(trackId: string) {
        if (self.jobsQueue[0]?.trackId === trackId && self.controller) {
          self.controller.abort()
        } else {
          self.jobsQueue.replace(
            self.jobsQueue.filter(j => j.trackId !== trackId),
          )
          self.getJobStatusWidget().addJob({
            name: trackId,
            state: 'aborted',
            statusMessage: 'Cancelled',
          })
        }
      },
      /**
       * #action
       */
      reportStatus(trackId: string, status: RpcStatus) {
        const fraction = statusFraction(status)
        self
          .getJobStatusWidget()
          .updateJobStatus(
            trackId,
            statusText(status),
            fraction === undefined ? undefined : fraction * 100,
          )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Never rejects: every failure lands in its catch, which tells a tree
       * torn down mid-run apart from an error.
       */
      async runIndexingJob(entry: TextJobsEntry) {
        const { trackId, attributes, exclude, assemblies } = toJS(entry)
        const controller = new AbortController()
        self.setController(controller)
        try {
          self.getJobStatusWidget().addJob({ name: trackId, state: 'running' })
          // inside the try: a since-deleted track makes findTrackConfigsToIndex
          // throw, and the catch reports it
          const trackConfigs = findTrackConfigsToIndex(self.tracks, [
            trackId,
          ]).map(c => toJS(c))
          const userData = await invokeIpc('userData')
          // A fresh folder per run, and the previous one kept: a copied track
          // or another saved session can still point at it, and nothing here
          // knows which do. Reset is what reclaims them.
          const outLocation = path.join(
            userData,
            NAME_INDICES_DIR,
            `trix-${Date.now()}`,
          )
          await self.rpcManager.call(
            'indexTracksSessionId',
            'TextIndexRpcMethod',
            {
              tracks: trackConfigs,
              policy: { attributes, exclude },
              outLocation,
              signal: controller.signal,
              statusCallback: status => {
                self.reportStatus(trackId, status)
              },
            },
          )
          // the configs that were actually indexed: a track filtered out for an
          // unsupported adapter must not get a success notice and a
          // textSearchAdapter pointing at an .ix that was never written
          for (const config of trackConfigs) {
            // re-found now, not the pre-RPC config: indexing ran for minutes,
            // and writing that stale copy back would revert any edit made to
            // the track meanwhile. A track deleted meanwhile gets neither the
            // write nor the notice.
            const current = self.session.trackBasesById.get(config.trackId)
            if (current) {
              self.root.updateTrackBase(
                indexedTrackConf(current, {
                  assemblies,
                  attributes,
                  exclude,
                  outLocation,
                }),
              )
              self.session.notify(
                `Indexed track ${entry.label ?? config.trackId}`,
                'success',
              )
            }
          }
          self.getJobStatusWidget().addJob({
            name: trackId,
            state: 'finished',
            statusMessage: 'Done',
            progressPct: undefined,
          })
        } catch (e) {
          // The tree can go while the RPC runs — "Return to start screen", a
          // session swap, quitting — and everything here reaches for it
          // through `self.session`, a getParent hop that throws on a dead node
          // rather than warning. Both halves of the teardown arrive here: the
          // detach destroys the RPC workers, so a call in flight rejects into
          // this catch, and one that had already resolved throws into it on
          // the first read the success branch makes.
          if (isAlive(self)) {
            const cancelled = controller.signal.aborted
            if (cancelled) {
              self.session.notify(
                `Cancelled indexing ${entry.label ?? trackId}`,
                'info',
              )
            } else {
              console.error(e)
              self.session.notifyError(
                `An error occurred while indexing: ${e}`,
                e,
                undefined,
                {
                  name: 'Retry',
                  onClick: () => {
                    // a plain snapshot; the dequeue below drops `entry` from
                    // the observable queue
                    this.queueJob(toJS(entry))
                  },
                },
              )
            }
            self.getJobStatusWidget().addJob({
              name: trackId,
              state: 'aborted',
              statusMessage: cancelled ? 'Cancelled' : `${e}`,
              progressPct: undefined,
            })
          }
        }
        if (isAlive(self)) {
          self.dequeue()
          self.setController(undefined)
        }
      },
      /**
       * #action
       */
      async runQueue() {
        while (isAlive(self) && self.jobsQueue.length > 0) {
          await this.runIndexingJob(self.jobsQueue[0]!)
        }
      },
      /**
       * #action
       * Opens the Jobs list and files the track as queued, starting the queue
       * if it was idle. A track already queued or running is filed once.
       */
      queueJob(entry: TextJobsEntry) {
        const widget = self.getJobStatusWidget()
        self.session.showWidget(widget)
        if (!self.jobsQueue.some(j => j.trackId === entry.trackId)) {
          widget.addJob({
            name: entry.trackId,
            label: entry.label,
            state: 'queued',
            statusMessage: undefined,
            progressPct: undefined,
            cancelCallback: () => {
              self.cancelJob(entry.trackId)
            },
          })
          self.jobsQueue.push(entry)
          if (self.jobsQueue.length === 1) {
            void this.runQueue()
          }
        }
      },
    }))
}

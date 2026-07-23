import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { Job } from './jobModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

export type JobSnapshot = SnapshotIn<typeof Job>

/**
 * Input for adding a job. `name` is the persisted property; `statusMessage`,
 * `progressPct`, and `cancelCallback` are volatile runtime state applied via
 * the job's setters after creation.
 */
export interface JobInput {
  name: string
  statusMessage?: string
  progressPct?: number
  cancelCallback?: () => void
}

/**
 * #stateModel JobsListModel
 * #internal desktop text-indexing queue internals — kept out of the website docs
 * #category widget
 */
export function stateModelFactory(_pluginManager: PluginManager) {
  return types
    .model('JobsListModel', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.literal('JobsListWidget'),
      /**
       * #property
       */
      jobs: types.array(Job),
      /**
       * #property
       */
      finished: types.array(Job),
      /**
       * #property
       */
      queued: types.array(Job),
      /**
       * #property
       */
      aborted: types.array(Job),
    })
    .actions(self => {
      function addJobToArray(arr: typeof self.jobs, job: JobInput) {
        // dedupe by name so re-adding doesn't create a duplicate card, but
        // still refresh the fields so a repeated same-named job (common in
        // Apollo's job manager) shows current status rather than stale state
        let target = arr.find(j => j.name === job.name)
        if (!target) {
          const length = arr.push({ name: job.name })
          target = arr[length - 1]!
        }
        if (job.cancelCallback) {
          target.setCancelCallback(job.cancelCallback)
        }
        if (job.statusMessage !== undefined) {
          target.setStatusMessage(job.statusMessage)
        }
        if (job.progressPct !== undefined) {
          target.setProgressPct(job.progressPct)
        }
        return target
      }

      function removeFromArray(arr: typeof self.jobs, jobName: string) {
        const index = arr.findIndex(j => j.name === jobName)
        if (index === -1) {
          return undefined
        }
        return arr.splice(index, 1)[0]
      }

      return {
        /**
         * #action
         */
        addJob(job: JobInput) {
          return addJobToArray(self.jobs, job)
        },
        /**
         * #action
         */
        removeJob(jobName: string) {
          return removeFromArray(self.jobs, jobName)
        },
        /**
         * #action
         */
        addFinishedJob(job: JobInput) {
          return addJobToArray(self.finished, job)
        },
        /**
         * #action
         */
        addQueuedJob(job: JobInput) {
          return addJobToArray(self.queued, job)
        },
        /**
         * #action
         */
        addAbortedJob(job: JobInput) {
          return addJobToArray(self.aborted, job)
        },
        /**
         * #action
         */
        removeQueuedJob(jobName: string) {
          return removeFromArray(self.queued, jobName)
        },
        /**
         * #action
         */
        clearFinished() {
          self.finished.clear()
        },
        /**
         * #action
         */
        clearAborted() {
          self.aborted.clear()
        },
        /**
         * #action
         */
        updateJobStatusMessage(jobName: string, message?: string) {
          // job may be absent if it was cancelled/removed while a status
          // callback was still in flight, so update only when present
          const job = self.jobs.find(j => j.name === jobName)
          if (job) {
            job.setStatusMessage(message)
          }
        },
        /**
         * #action
         */
        updateJobProgressPct(jobName: string, pct: number) {
          const job = self.jobs.find(j => j.name === jobName)
          if (job) {
            job.setProgressPct(pct)
          }
        },
      }
    })
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

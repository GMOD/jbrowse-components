import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { Job } from './jobModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

export type JobSnapshot = SnapshotIn<typeof Job>

export interface NewJob extends JobSnapshot {
  cancelCallback(): void
}

/**
 * #stateModel JobsListModel
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
      function addJobToArray(
        arr: typeof self.jobs,
        job: JobSnapshot,
        cancelCallback?: () => void,
      ) {
        const existing = arr.find(j => j.name === job.name)
        if (existing) {
          return existing
        }
        const length = arr.push(job)
        const added = arr[length - 1]!
        if (cancelCallback) {
          added.setCancelCallback(cancelCallback)
        }
        return added
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
        addJob(job: NewJob) {
          return addJobToArray(self.jobs, job, job.cancelCallback)
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
        addFinishedJob(job: JobSnapshot) {
          return addJobToArray(self.finished, job)
        },
        /**
         * #action
         */
        addQueuedJob(job: JobSnapshot) {
          return addJobToArray(self.queued, job)
        },
        /**
         * #action
         */
        addAbortedJob(job: JobSnapshot) {
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
        updateJobStatusMessage(jobName: string, message?: string) {
          const job = self.jobs.find(j => j.name === jobName)
          if (!job) {
            throw new Error(`No job found with name ${jobName}`)
          }
          job.setStatusMessage(message)
        },
        /**
         * #action
         */
        updateJobProgressPct(jobName: string, pct: number) {
          const job = self.jobs.find(j => j.name === jobName)
          if (!job) {
            throw new Error(`No job found with name ${jobName}`)
          }
          job.setProgressPct(pct)
        },
      }
    })
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

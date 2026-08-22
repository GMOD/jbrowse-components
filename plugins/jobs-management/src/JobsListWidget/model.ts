import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { Job } from './jobModel.ts'

import type { JobModel } from './jobModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { IObservableArray } from 'mobx'

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
    })
    .volatile(() => ({
      /**
       * #volatile
       * Volatile like the `jobsQueue` these mirror: persisted, a session saved
       * mid-index came back with a permanent "Running" card whose Cancel called
       * the default no-op, and a "Queued" card in no queue.
       */
      jobs: observable.array<JobModel>([], { deep: false }),
      /**
       * #volatile
       */
      finished: observable.array<JobModel>([], { deep: false }),
      /**
       * #volatile
       */
      queued: observable.array<JobModel>([], { deep: false }),
      /**
       * #volatile
       */
      aborted: observable.array<JobModel>([], { deep: false }),
    }))
    .actions(self => {
      function addJobToArray(arr: IObservableArray<JobModel>, job: JobInput) {
        // dedupe by name so re-adding doesn't create a duplicate card, but
        // still refresh the fields so a repeated same-named job (common in
        // Apollo's job manager) shows current status rather than stale state
        let target = arr.find(j => j.name === job.name)
        if (!target) {
          target = Job.create({ name: job.name })
          arr.push(target)
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

      function removeFromArray(
        arr: IObservableArray<JobModel>,
        jobName: string,
      ) {
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
         * A phase carrying no fraction clears the old one rather than leaving
         * the bar where the last phase left it.
         */
        updateJobStatus(jobName: string, message?: string, pct?: number) {
          // absent if cancelled/removed while a status callback was in flight
          const job = self.jobs.find(j => j.name === jobName)
          if (job) {
            job.setStatusMessage(message)
            job.setProgressPct(pct)
          }
        },
      }
    })
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

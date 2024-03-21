import { types, Instance, SnapshotIn } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { Job } from './jobModel'

export interface NewJob extends SnapshotIn<typeof Job> {
  cancelCallback(): void
  setStatusMessage(msg?: string): void
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
      aborted: types.array(Job),

      /**
       * #property
       */
      finished: types.array(Job),

      /**
       * #property
       */
      id: ElementId,

      /**
       * #property
       */
      jobs: types.array(Job),

      /**
       * #property
       */
      queued: types.array(Job),

      /**
       * #property
       */
      type: types.literal('JobsListWidget'),
    })
    .actions(self => ({
      /**
       * #action
       */
      addAbortedJob(job: NewJob) {
        self.aborted.push(job)
        return self.aborted
      },

      /**
       * #action
       */
      addFinishedJob(job: NewJob) {
        self.finished.push(job)
        return self.finished
      },

      /**
       * #action
       */
      addJob(job: NewJob) {
        const { cancelCallback } = job
        const length = self.jobs.push(job)
        const addedJob = self.jobs[length - 1]
        addedJob.setCancelCallback(cancelCallback)
        return addedJob
      },

      /**
       * #action
       */
      addQueuedJob(job: NewJob) {
        self.queued.push(job)
        return self.finished
      },

      /**
       * #action
       */
      removeJob(jobName: string) {
        const indx = self.jobs.findIndex(job => job.name === jobName)
        const removed = self.jobs[indx]
        self.jobs.splice(indx, 1)
        return removed
      },
      /**
       * #action
       */
      removeQueuedJob(jobName: string) {
        const indx = self.queued.findIndex(job => job.name === jobName)
        const removed = self.queued[indx]
        self.queued.splice(indx, 1)
        return removed
      },

      /**
       * #action
       */
      updateJobProgressPct(jobName: string, pct: number) {
        const job = self.jobs.find(job => job.name === jobName)
        if (!job) {
          throw new Error(`No job found with name ${jobName}`)
        }
        job.setProgressPct(pct)
      },

      /**
       * #action
       */
      updateJobStatusMessage(jobName: string, message?: string) {
        const job = self.jobs.find(job => job.name === jobName)
        if (!job) {
          throw new Error(`No job found with name ${jobName}`)
        }
        job.setStatusMessage(message)
      },
    }))
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

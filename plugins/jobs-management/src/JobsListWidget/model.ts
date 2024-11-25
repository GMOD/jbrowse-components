import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import { Job } from './jobModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance, SnapshotIn } from 'mobx-state-tree'

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
    .actions(self => ({
      /**
       * #action
       */
      addJob(job: NewJob) {
        const { cancelCallback } = job
        const length = self.jobs.push(job)
        const addedJob = self.jobs[length - 1]!
        addedJob.setCancelCallback(cancelCallback)
        return addedJob
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
      addFinishedJob(job: NewJob) {
        self.finished.push(job)
        return self.finished
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
      addAbortedJob(job: NewJob) {
        self.aborted.push(job)
        return self.aborted
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
      updateJobStatusMessage(jobName: string, message?: string) {
        const job = self.jobs.find(job => job.name === jobName)
        if (!job) {
          throw new Error(`No job found with name ${jobName}`)
        }
        job.setStatusMessage(message)
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
    }))
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

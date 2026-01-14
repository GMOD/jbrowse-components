import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { Job } from './jobModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

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
        const { cancelCallback, name } = job
        const existing = self.jobs.find(job => job.name === name)
        if (existing) {
          return existing
        }
        const length = self.jobs.push(job)
        const addedJob = self.jobs[length - 1]!
        addedJob.setCancelCallback(cancelCallback)
        return addedJob
      },
      /**
       * #action
       */
      removeJob(jobName: string) {
        const index = self.jobs.findIndex(job => job.name === jobName)
        if (index === -1) {
          return undefined
        }
        const removed = self.jobs.splice(index, 1)
        return removed[0]
      },
      /**
       * #action
       */
      addFinishedJob(job: NewJob) {
        const existing = self.finished.find(
          finishedJob => finishedJob.name === job.name,
        )
        if (existing) {
          return existing
        }
        const length = self.finished.push(job)
        return self.finished[length - 1]
      },
      /**
       * #action
       */
      addQueuedJob(job: NewJob) {
        const existing = self.queued.find(
          queuedJob => queuedJob.name === job.name,
        )
        if (existing) {
          return existing
        }
        const length = self.queued.push(job)
        return self.queued[length - 1]
      },
      /**
       * #action
       */
      addAbortedJob(job: NewJob) {
        const existing = self.aborted.find(
          abortedJob => abortedJob.name === job.name,
        )
        if (existing) {
          return existing
        }
        const length = self.aborted.push(job)
        return self.aborted[length - 1]
      },
      /**
       * #action
       */
      removeQueuedJob(jobName: string) {
        const index = self.queued.findIndex(job => job.name === jobName)
        if (index === -1) {
          return undefined
        }
        const removed = self.queued.splice(index, 1)
        return removed[0]
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

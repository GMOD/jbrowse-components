import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { Job } from './jobModel.ts'

import type { JobFields, JobModel, JobState } from './jobModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface JobInput extends Partial<JobFields> {
  name: string
  state: JobState
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
       * Volatile like the `jobsQueue` it mirrors: persisted, a session saved
       * mid-index came back with a permanent "Running" card whose Cancel called
       * the default no-op, and a "Queued" card in no queue.
       */
      jobs: observable.array<JobModel>([], { deep: false }),
    }))
    .actions(self => ({
      /**
       * #action
       * Files a job under `state`, or moves the one already named that and
       * refreshes whatever fields came with it. A job runs, finishes and is
       * retried under one name, so this is the only way a card is filed.
       */
      addJob({ name, ...fields }: JobInput) {
        let job = self.jobs.find(j => j.name === name)
        if (!job) {
          job = Job.create({ name })
          self.jobs.push(job)
        }
        job.update(fields)
        return job
      },
      /**
       * #action
       * A phase carrying no fraction clears the old one rather than leaving
       * the bar where the last phase left it.
       */
      updateJobStatus(name: string, statusMessage?: string, pct?: number) {
        // absent if the widget was rebuilt while a status callback was in flight
        self.jobs
          .find(j => j.name === name)
          ?.update({ statusMessage, progressPct: pct })
      },
      /**
       * #action
       */
      clearJobs(state: JobState) {
        self.jobs.replace(self.jobs.filter(j => j.state !== state))
      },
    }))
}

export type JobsListStateModel = ReturnType<typeof stateModelFactory>
export type JobsListModel = Instance<JobsListStateModel>

import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

export type JobState = 'running' | 'queued' | 'finished' | 'aborted'

export interface JobFields {
  state: JobState
  statusMessage?: string
  progressPct?: number
  cancelCallback: () => void
}

/**
 * #stateModel
 * #internal desktop text-indexing queue internals — kept out of the website docs
 * #category widget
 *
 * Created standalone by `JobsListModel` and held in its volatile list rather
 * than attached under it — nothing here belongs in a saved session.
 */
export const Job = types
  .model('Job', {
    /**
     * #property
     */
    name: types.string,
  })
  .volatile((): JobFields => ({
    /**
     * #volatile
     * which of the widget's four sections the job is filed under. One field
     * rather than membership of one of four lists, so it cannot be in two.
     */
    state: 'queued',
    /**
     * #volatile
     */
    statusMessage: undefined,
    /**
     * #volatile
     * undefined when the current phase has no fraction to report, which the
     * card draws as an indeterminate bar
     */
    progressPct: undefined,
    /**
     * #volatile
     */
    cancelCallback: () => {},
  }))
  .actions(self => ({
    /**
     * #action
     * A key that is present is written, so `{statusMessage: undefined}` clears
     * the message and `{}` touches nothing.
     */
    update(fields: Partial<JobFields>) {
      Object.assign(self, fields)
    },
  }))

export type JobModel = Instance<typeof Job>

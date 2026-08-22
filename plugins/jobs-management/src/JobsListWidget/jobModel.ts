import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel
 * #internal desktop text-indexing queue internals — kept out of the website docs
 * #category widget
 *
 * Created standalone by `JobsListModel` and held in its volatile lists rather
 * than attached under it — nothing here belongs in a saved session.
 */
export const Job = types
  .model('Job', {
    /**
     * #property
     */
    name: types.string,
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    cancelCallback() {},
    /**
     * #volatile
     */
    statusMessage: undefined as string | undefined,
    /**
     * #volatile
     * undefined when the current phase has no fraction to report, which the
     * card draws as an indeterminate bar
     */
    progressPct: undefined as number | undefined,
  }))
  .actions(self => ({
    /**
     * #action
     */
    setCancelCallback(cancelCallback: () => void) {
      self.cancelCallback = cancelCallback
    },

    /**
     * #action
     */
    setStatusMessage(message?: string) {
      self.statusMessage = message
    },

    /**
     * #action
     */
    setProgressPct(pct?: number) {
      self.progressPct = pct
    },
  }))

export type JobModel = Instance<typeof Job>

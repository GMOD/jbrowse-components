import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel
 * #internal desktop text-indexing queue internals — kept out of the website docs
 * #category widget
 */
export const Job = types
  .model('Job', {
    /**
     * #property
     */
    name: types.string,
  })
  .volatile(() => ({
    cancelCallback() {},
    /**
     * #volatile
     */
    statusMessage: undefined as string | undefined,
    /**
     * #volatile
     */
    progressPct: 0,
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
    setProgressPct(pct: number) {
      self.progressPct = pct
    },
  }))

export type JobModel = Instance<typeof Job>

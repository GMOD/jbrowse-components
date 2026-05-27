import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel
 */
export const Job = types
  .model('Job', {
    /**
     * #property
     */
    name: types.string,
    /**
     * #property
     */
    statusMessage: types.maybe(types.string),
    /**
     * #property
     */
    progressPct: types.optional(types.number, 0),
  })
  .volatile(() => ({
    cancelCallback() {},
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

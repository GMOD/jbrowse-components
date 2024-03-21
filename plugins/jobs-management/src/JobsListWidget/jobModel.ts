import { types } from 'mobx-state-tree'

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
    progressPct: types.number,

    /**
     * #property
     */
    statusMessage: types.maybe(types.string),
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
    setProgressPct(pct: number) {
      self.progressPct = pct
    },

    /**
     * #action
     */
    setStatusMessage(message?: string) {
      self.statusMessage = message
    },
  }))

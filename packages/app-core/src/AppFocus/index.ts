import { types } from 'mobx-state-tree'

/**
 * #stateModel AppFocusMixin
 * #category session
 */
export function AppFocusMixin() {
  return types
    .model({
      /**
       * #property
       * used to keep track of which view is in focus
       */
      focusedViewId: types.maybe(types.string),
    })
    .actions(self => ({
      /**
       * #action
       */
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
    }))
}

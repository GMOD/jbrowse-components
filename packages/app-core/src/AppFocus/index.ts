import { types } from 'mobx-state-tree'
import { AbstractViewModel } from '@jbrowse/core/util'

/**
 * #stateModel AppFocusMixin
 * #category root
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
    .views(self => ({
      get focusedView() {
        // @ts-ignore
        return self.session.views.find(
          (view: AbstractViewModel) => view.id === self.focusedViewId,
        )
      },
    }))
    .actions(self => ({
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
    }))
}

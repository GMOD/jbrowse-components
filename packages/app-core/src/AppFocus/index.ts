import { types } from 'mobx-state-tree'
import { AbstractViewModel } from '@jbrowse/core/util'

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
    .views(self => ({
      get focusedView() {
        let viewCount = 0
        let target = undefined as unknown
        // @ts-ignore
        self.views.forEach((view: AbstractViewModel) => {
          viewCount++
          // seeks out potential matches for view and subviews
          // @ts-ignore
          if (view.views) {
            // @ts-ignore
            viewCount += view.views.length
            // @ts-ignore
            target = view.views.find(
              (subView: AbstractViewModel) => subView.id === self.focusedViewId,
            )
          }
          if (view.id === self.focusedViewId) {
            target = view
          }
        })
        if (viewCount > 1) {
          return target as AbstractViewModel
        }
        return undefined
      },
    }))
    .actions(self => ({
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
    }))
}

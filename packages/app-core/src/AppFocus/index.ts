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
        let target = undefined as unknown
        // @ts-ignore
        self.views.forEach((view: AbstractViewModel) => {
          // seeks out potential matches for view and subviews
          // @ts-ignore
          if (view.views) {
            // @ts-ignore
            target = view.views.find(
              (subView: AbstractViewModel) => subView.id === self.focusedViewId,
            )
          }
          if (view.id === self.focusedViewId) {
            target = view
          }
        })
        return target as AbstractViewModel
      },
    }))
    .actions(self => ({
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
      afterCreate() {
        document.addEventListener('keydown', e => {
          if (self.focusedView) {
            if (e.code === 'ArrowLeft') {
              // pan left
              self.focusedView.slide(-0.9)
            }
            if (e.code === 'ArrowRight') {
              // pan right
              self.focusedView.slide(0.9)
            }
            if (e.shiftKey && e.code === 'ArrowUp') {
              // zoom in
              self.focusedView.zoom(self.focusedView.bpPerPx / 2)
            }
            if (e.shiftKey && e.code === 'ArrowDown') {
              // zoom out
              self.focusedView.zoom(self.focusedView.bpPerPx * 2)
            }
          }
        })
      },
    }))
}

import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'
import { AbstractSessionModel, AbstractViewModel } from '@jbrowse/core/util'

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
      setFocusedViewId(viewId: string) {
        self.focusedViewId = viewId
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
            const session = self as AbstractSessionModel
            if (session) {
              const view = session.views.at(-1)
              if (
                view &&
                !session.views.some(
                  (view: AbstractViewModel) =>
                    view.id === session.focusedViewId,
                ) &&
                !session.views.some(
                  view =>
                    // @ts-ignore
                    !!view.views &&
                    // @ts-ignore
                    view.views.some(
                      (subView: AbstractViewModel) =>
                        subView.id === session.focusedViewId,
                    ),
                )
              ) {
                this.setFocusedViewId(view.id)
              }
            }
          }),
        )
      },
    }))
}

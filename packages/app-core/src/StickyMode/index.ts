import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

/**
 * #stateModel StickyModeMixin
 * #category session
 */
export function StickyModeMixin() {
  return types
    .model({
      /**
       * #property
       * used to keep track of which view is in focus
       */
      stickyMode: types.optional(types.boolean, () =>
        Boolean(
          JSON.parse(localStorageGetItem('view-stickyHeaders') || 'true'),
        ),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      setStickyMode(b: boolean) {
        self.stickyMode = b
      },
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem(
              'view-stickyHeaders',
              JSON.stringify(self.stickyMode),
            )
          }),
        )
      },
    }))
}

import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import type { BaseRootModel } from '@jbrowse/product-core'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

/**
 * #stateModel HistoryManagementMixin
 * #category root
 */
export function HistoryManagementMixin() {
  return types
    .model({
      /**
       * #property
       * used for undo/redo
       */
      history: types.optional(TimeTraveller, { targetPath: '../session' }),
    })
    .actions(self => ({
      afterCreate() {
        document.addEventListener('keydown', e => {
          const { canRedo, canUndo } = self.history

          // return if input is focused
          if (document.activeElement?.tagName.toUpperCase() === 'INPUT') {
            return
          }
          const b1 = e.ctrlKey || e.metaKey

          // ctrl+shift+z or cmd+shift+z or  ctrl+y
          if (
            canRedo &&
            ((b1 && e.shiftKey && e.code === 'KeyZ') ||
              (e.ctrlKey && !e.shiftKey && e.code === 'KeyY'))
          ) {
            self.history.redo()
          }
          // ctrl+z or cmd+z
          if (canUndo && b1 && !e.shiftKey && e.code === 'KeyZ') {
            self.history.undo()
          }
        })
        addDisposer(
          self,
          autorun(() => {
            const { session } = self as typeof self & BaseRootModel
            if (session) {
              // we use a specific initialization routine after session is
              // created to get it to start tracking itself sort of related
              // issue here
              // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
              self.history.initialize()
            }
          }),
        )
      },
    }))
}

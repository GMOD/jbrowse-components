import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { asRoot } from '@jbrowse/product-core'
import { autorun } from 'mobx'

/**
 * Whether the user is typing into something with an undo stack of its own.
 *
 * Session undo must not steal the text editor's. The keydown listener below is
 * on `document`, so it sees ctrl+z no matter what has focus — including the
 * multiline TextFields the config editor, the jexl/JSON monospace field, and
 * the paste-config workflows are built from. Those render a `<textarea>`, not
 * an `<input>`, so an INPUT-only check let a keystroke meant to undo typing
 * roll back the whole session instead.
 */
export function isTextEntryFocused() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const tag = el.tagName.toUpperCase()
  // coerced: isContentEditable is declared boolean but is undefined in jsdom,
  // so the raw expression returns undefined for an ordinary focused element
  return tag === 'INPUT' || tag === 'TEXTAREA' || !!el.isContentEditable
}

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
    .actions(self => {
      const keydownListener = (e: KeyboardEvent) => {
        if (isTextEntryFocused()) {
          return
        }
        if (
          self.history.canRedo &&
          // ctrl+shift+z or cmd+shift+z
          (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
            // ctrl+y
            (e.ctrlKey && !e.shiftKey && e.code === 'KeyY'))
        ) {
          self.history.redo()
        }
        if (
          self.history.canUndo &&
          // ctrl+z or cmd+z
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.code === 'KeyZ'
        ) {
          self.history.undo()
        }
      }
      return {
        afterCreate() {
          document.addEventListener('keydown', keydownListener)
          addDisposer(
            self,
            autorun(
              function historyInitAutorun() {
                const { session } = asRoot(self)
                if (session) {
                  // we use a specific initialization routine after session is
                  // created to get it to start tracking itself sort of related
                  // issue here
                  // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
                  self.history.initialize()
                }
              },
              { name: 'HistoryInit' },
            ),
          )
        },
        beforeDestroy() {
          document.removeEventListener('keydown', keydownListener)
        },
      }
    })
}

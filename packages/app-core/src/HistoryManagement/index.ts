import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import { isTextEntryFocused } from '@jbrowse/core/util/isTextEntryFocused'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { asRoot } from '@jbrowse/product-core'
import { autorun } from 'mobx'

type ShortcutKeys = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey'
>

// `key` follows the layout, so undo is wherever the user's Z is (QWERTZ reports
// it as `code: 'KeyY'`, AZERTY as `KeyW`); a non-Latin layout has no letter
// there, and the physical key stands in
function shortcutLetter(e: ShortcutKeys) {
  const key = e.key.toLowerCase()
  return /^[a-z]$/.test(key) ? key : e.code.replace(/^Key/, '').toLowerCase()
}

// modifiers first: a synthetic keydown (autofill, an extension) is a bare Event
// with no `key` to read
export function historyShortcut(e: ShortcutKeys) {
  if (!e.ctrlKey && !e.metaKey) {
    return undefined
  }
  const letter = shortcutLetter(e)
  if (letter === 'z') {
    return e.shiftKey ? 'redo' : 'undo'
  }
  if (e.ctrlKey && !e.shiftKey && letter === 'y') {
    return 'redo'
  }
  return undefined
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
        const shortcut = historyShortcut(e)
        if (shortcut === 'redo' && self.history.canRedo) {
          self.history.redo()
        } else if (shortcut === 'undo' && self.history.canUndo) {
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

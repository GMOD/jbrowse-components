import { addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'

//icons
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'

export function addUndoKeyboardShortcuts(self: any) {
  function undo(e: KeyboardEvent) {
    const cm = e.ctrlKey || e.metaKey
    if (self.history.canRedo) {
      if (
        // ctrl+shift+z or cmd+shift+z
        (cm && e.shiftKey && e.code === 'KeyZ') ||
        // ctrl+y
        (e.ctrlKey && !e.shiftKey && e.code === 'KeyY')
      ) {
        self.history.redo()
      }
    } else if (self.history.canUndo) {
      // ctrl+z or cmd+z
      if (cm && !e.shiftKey && e.code === 'KeyZ') {
        self.history.undo()
      }
    }
  }
  document.addEventListener('keydown', undo)
  addDisposer(self, () => document.removeEventListener('keydown', undo))
}

export function initUndoModel(self: any) {
  addDisposer(
    self,
    autorun(() => {
      if (self.session) {
        // we use a specific initialization routine after session is created to
        // get it to start tracking itself sort of related issue here
        // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
        self.history.initialize()
      }
    }),
  )
}

export function undoMenuItems(self: any) {
  return [
    {
      label: 'Undo',
      disabled: self.history.canUndo,
      icon: UndoIcon,
      onClick: () => {
        self.history.undo()
      },
    },
    {
      label: 'Redo',
      disabled: self.history.canRedo,
      icon: RedoIcon,
      onClick: () => {
        self.history.redo()
      },
    },
  ]
}

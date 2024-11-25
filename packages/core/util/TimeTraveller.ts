// adapted from https://github.com/mobxjs/mobx-state-tree/blob/master/packages/mst-middlewares/src/time-traveller.ts
import {
  types,
  resolvePath,
  getEnv,
  onSnapshot,
  getSnapshot,
  applySnapshot,
} from 'mobx-state-tree'
import type { IDisposer, IAnyStateTreeNode } from 'mobx-state-tree'

const MAX_HISTORY_LENGTH = 20

function debounce(func: (...args: unknown[]) => void, timeout = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      func(...args)
    }, timeout)
  }
}

const TimeTraveller = types
  .model('TimeTraveller', {
    undoIdx: -1,
    targetPath: '',
  })
  .volatile(() => ({
    history: [] as unknown[],
    notTrackingUndo: false,
  }))
  .views(self => ({
    get canUndo() {
      return self.undoIdx > 0 && !self.notTrackingUndo
    },
    get canRedo() {
      return self.undoIdx < self.history.length - 1 && !self.notTrackingUndo
    },
  }))
  .actions(self => {
    let targetStore: IAnyStateTreeNode | undefined
    let snapshotDisposer: IDisposer
    let skipNextUndoState = false

    return {
      // allows user code to (temporarily) stop tracking undo states
      stopTrackingUndo() {
        self.notTrackingUndo = true
      },
      // allows user code to resume tracking undo states
      resumeTrackingUndo() {
        self.notTrackingUndo = false
      },
      addUndoState(todos: unknown) {
        if (self.notTrackingUndo) {
          return
        }
        if (skipNextUndoState) {
          // skip recording if this state was caused by undo / redo
          skipNextUndoState = false
          return
        }
        self.history.splice(self.undoIdx + 1)
        self.history.push(todos)
        if (self.history.length > MAX_HISTORY_LENGTH) {
          self.history.shift()
        }
        self.undoIdx = self.history.length - 1
      },

      beforeDestroy() {
        snapshotDisposer()
      },
      initialize() {
        targetStore = self.targetPath
          ? resolvePath(self, self.targetPath)
          : getEnv(self).targetStore

        if (!targetStore) {
          throw new Error(
            'Failed to find target store for TimeTraveller. Please provide `targetPath` property, or a `targetStore` in the environment',
          )
        }

        snapshotDisposer = onSnapshot(
          targetStore,
          debounce((snapshot: unknown) => {
            this.addUndoState(snapshot)
          }, 300),
        )
        if (self.history.length === 0) {
          this.addUndoState(getSnapshot(targetStore))
        }
      },
      undo() {
        self.undoIdx--
        skipNextUndoState = true
        if (targetStore) {
          applySnapshot(targetStore, self.history[self.undoIdx])
        }
      },
      redo() {
        self.undoIdx++
        skipNextUndoState = true
        if (targetStore) {
          applySnapshot(targetStore, self.history[self.undoIdx])
        }
      },
    }
  })

export default TimeTraveller

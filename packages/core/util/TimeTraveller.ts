// adapted from https://github.com/mobxjs/mobx-state-tree/blob/master/packages/mst-middlewares/src/time-traveller.ts
import {
  types,
  resolvePath,
  getEnv,
  onSnapshot,
  getSnapshot,
  applySnapshot,
  IDisposer,
  IAnyStateTreeNode,
} from 'mobx-state-tree'

const MAX_HISTORY_LENGTH = 20

function debounce(func: (...args: unknown[]) => void, timeout = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => func(...args), timeout)
  }
}

const TimeTraveller = types
  .model('TimeTraveller', {
    history: types.array(types.frozen()),
    undoIdx: -1,
    targetPath: '',
  })
  .volatile(() => ({
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
    let targetStore: IAnyStateTreeNode
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
        // this is needed to get MST to start tracking itself
        // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
        targetStore = self.targetPath
          ? resolvePath(self, self.targetPath)
          : getEnv(self).targetStore

        if (!targetStore) {
          throw new Error(
            'Failed to find target store for TimeTraveller. Please provide `targetPath` property, or a `targetStore` in the environment',
          )
        }
        // TODO: check if targetStore doesn't contain self
        // if (contains(targetStore, self)) throw new Error("TimeTraveller shouldn't be recording itself. Please specify a sibling as taret, not some parent")
        // start listening to changes
        snapshotDisposer = onSnapshot(
          targetStore,
          debounce((snapshot: unknown) => this.addUndoState(snapshot), 300),
        )
        // record an initial state if no known
        if (self.history.length === 0) {
          this.addUndoState(getSnapshot(targetStore))
        }
      },
      undo() {
        self.undoIdx--
        skipNextUndoState = true
        applySnapshot(targetStore, self.history[self.undoIdx])
      },
      redo() {
        self.undoIdx++
        skipNextUndoState = true
        applySnapshot(targetStore, self.history[self.undoIdx])
      },
    }
  })

export default TimeTraveller

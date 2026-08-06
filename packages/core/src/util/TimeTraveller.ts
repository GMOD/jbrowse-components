// adapted from https://github.com/mobxjs/mobx-state-tree
import {
  applySnapshot,
  getEnv,
  getSnapshot,
  onSnapshot,
  resolvePath,
  types,
} from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode, IDisposer } from '@jbrowse/mobx-state-tree'

const MAX_HISTORY_LENGTH = 20

/**
 * #stateModel TimeTraveller
 * Undo/redo history for a target state-tree node: records snapshots as it
 * changes and exposes canUndo/canRedo with undo/redo actions.
 */
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
    let snapshotDisposer: IDisposer | undefined
    let skipNextUndoState = false
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    let pendingSnapshot: unknown

    return {
      stopTrackingUndo() {
        self.notTrackingUndo = true
      },
      resumeTrackingUndo() {
        self.notTrackingUndo = false
      },
      addUndoState(snapshot: unknown) {
        if (self.notTrackingUndo) {
          return
        }
        self.history.splice(self.undoIdx + 1)
        self.history.push(snapshot)
        if (self.history.length > MAX_HISTORY_LENGTH) {
          self.history.shift()
        }
        self.undoIdx = self.history.length - 1
      },

      beforeDestroy() {
        // initialize() only runs once a session exists, so a root torn down
        // before that (a failed boot, a test) has no disposer to call
        snapshotDisposer?.()
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
      },
      /**
       * Start recording history for the target store. Re-runs whenever the root
       * swaps in a new session node, so it must be idempotent: the previous
       * registration is disposed and the history reset, because `history` is
       * volatile while `undoIdx` is a persisted prop — carrying the old
       * session's snapshots forward would make undo apply them to the new one.
       */
      initialize() {
        targetStore = self.targetPath
          ? resolvePath(self, self.targetPath)
          : getEnv(self).targetStore

        if (!targetStore) {
          throw new Error(
            'Failed to find target store for TimeTraveller. Please provide `targetPath` property, or a `targetStore` in the environment',
          )
        }

        snapshotDisposer?.()
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = undefined
        }
        pendingSnapshot = undefined
        skipNextUndoState = false
        self.history = []
        self.undoIdx = -1

        snapshotDisposer = onSnapshot(targetStore, snapshot => {
          if (self.notTrackingUndo) {
            return
          }

          // undo/redo sets skipNextUndoState before calling applySnapshot.
          // Reset the flag here and cancel any pending debounce so the
          // applied snapshot is never recorded as an undoable action.
          if (skipNextUndoState) {
            skipNextUndoState = false
            if (debounceTimer) {
              clearTimeout(debounceTimer)
              debounceTimer = undefined
            }
            return
          }

          pendingSnapshot = snapshot
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            debounceTimer = undefined
            this.addUndoState(pendingSnapshot)
          }, 300)
        })

        this.addUndoState(getSnapshot(targetStore))
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

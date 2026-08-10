// adapted from https://github.com/mobxjs/mobx-state-tree
import {
  applySnapshot,
  getEnv,
  getSnapshot,
  onPatch,
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
        skipNextUndoState = false
        self.history = []
        self.undoIdx = -1

        // onPatch, not onSnapshot: this only needs to know *that* the target
        // changed, and the snapshot is taken once per debounce window below.
        // onSnapshot would serialize the whole target on every single change to
        // hand the callback a snapshot we then throw away — debouncing the
        // handler does not debounce that, because MST has to build the snapshot
        // to call the handler at all. Measured on a LinearGenomeView drag, this
        // was the only listener in the app firing every frame, re-serializing
        // the entire session ~120 times per second to record it ~3 times.
        // Patches fire synchronously on the same changes, so the flag handling
        // below keeps its original ordering.
        snapshotDisposer = onPatch(targetStore, () => {
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

          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            debounceTimer = undefined
            // read the target's current state rather than a snapshot captured
            // per change: any change inside the window resets this timer, so
            // when it does fire the two agree
            if (targetStore) {
              this.addUndoState(getSnapshot(targetStore))
            }
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

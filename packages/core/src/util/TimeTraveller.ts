// adapted from https://github.com/mobxjs/mobx-state-tree/blob/master/packages/mst-middlewares/src/time-traveller.ts
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
        if (skipNextUndoState) {
          skipNextUndoState = false
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
        snapshotDisposer()
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
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

        snapshotDisposer = onSnapshot(targetStore, snapshot => {
          // Early exit if not tracking - avoid timer operations entirely
          if (self.notTrackingUndo || skipNextUndoState) {
            return
          }

          // Store latest snapshot for when timer fires
          pendingSnapshot = snapshot

          // Debounce: reset timer on each change to wait for inactivity
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            debounceTimer = undefined
            this.addUndoState(pendingSnapshot)
          }, 300)
        })

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

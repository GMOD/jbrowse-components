// adapted from https://github.com/mobxjs/mobx-state-tree/blob/master/packages/mst-middlewares/src/time-traveller.ts
import {
  applyPatch,
  getEnv,
  onPatch,
  resolvePath,
  types,
} from '@jbrowse/mobx-state-tree'

import type {
  IAnyStateTreeNode,
  IDisposer,
  IJsonPatch,
} from '@jbrowse/mobx-state-tree'

const MAX_HISTORY_LENGTH = 20

export interface PatchEntry {
  patches: IJsonPatch[]
  inversePatches: IJsonPatch[]
}

const TimeTraveller = types
  .model('TimeTraveller', {
    undoIdx: -1,
    targetPath: '',
  })
  .volatile(() => ({
    history: [] as PatchEntry[],
    notTrackingUndo: false,
  }))
  .views(self => ({
    get canUndo() {
      return self.undoIdx >= 0 && !self.notTrackingUndo
    },
    get canRedo() {
      return self.undoIdx < self.history.length - 1 && !self.notTrackingUndo
    },
  }))
  .actions(self => {
    let targetStore: IAnyStateTreeNode
    let patchDisposer: IDisposer | undefined
    let skipNextUndoState = false
    let pendingPatches: IJsonPatch[] = []
    let pendingInversePatches: IJsonPatch[] = []
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    function flushPatches(addUndoState: (entry: PatchEntry) => void) {
      if (pendingPatches.length > 0) {
        addUndoState({
          patches: pendingPatches,
          inversePatches: pendingInversePatches,
        })
        pendingPatches = []
        pendingInversePatches = []
      }
    }

    return {
      stopTrackingUndo() {
        self.notTrackingUndo = true
      },
      resumeTrackingUndo() {
        self.notTrackingUndo = false
      },
      addUndoState(entry: PatchEntry) {
        if (self.notTrackingUndo || skipNextUndoState) {
          skipNextUndoState = false
          return
        }
        self.history.splice(self.undoIdx + 1)
        self.history.push(entry)
        if (self.history.length > MAX_HISTORY_LENGTH) {
          self.history.shift()
        }
        self.undoIdx = self.history.length - 1
      },

      beforeDestroy() {
        if (patchDisposer) {
          patchDisposer()
        }
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
      },
      initialize() {
        targetStore = self.targetPath
          ? resolvePath(self, self.targetPath)
          : getEnv(self).targetStore

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!targetStore) {
          throw new Error(
            'Failed to find target store for TimeTraveller. Please provide `targetPath` property, or a `targetStore` in the environment',
          )
        }

        patchDisposer = onPatch(targetStore, (patch, inversePatch) => {
          if (self.notTrackingUndo || skipNextUndoState) {
            skipNextUndoState = false
            return
          }
          // Skip patches for derived/transient state that shouldn't be part of
          // undo history - blockState is recalculated from view position
          if (patch.path.includes('/blockState/')) {
            return
          }
          pendingPatches.push(patch)
          pendingInversePatches.push(inversePatch)

          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          debounceTimer = setTimeout(() => {
            flushPatches(this.addUndoState.bind(this))
          }, 300)
        })
      },
      undo() {
        const entry = self.history[self.undoIdx]
        if (!entry) {
          return
        }
        skipNextUndoState = true

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (targetStore) {
          for (let i = entry.inversePatches.length - 1; i >= 0; i--) {
            applyPatch(targetStore, entry.inversePatches[i]!)
          }
        }
        self.undoIdx--
        skipNextUndoState = false
      },
      redo() {
        const entry = self.history[self.undoIdx + 1]
        if (!entry) {
          return
        }
        skipNextUndoState = true

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (targetStore) {
          for (const patch of entry.patches) {
            applyPatch(targetStore, patch)
          }
        }
        self.undoIdx++
        skipNextUndoState = false
      },
    }
  })

export default TimeTraveller

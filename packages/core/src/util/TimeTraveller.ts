// adapted from https://github.com/mobxjs/mobx-state-tree
import {
  applySnapshot,
  getEnv,
  getSnapshot,
  getType,
  isStateTreeNode,
  onPatch,
  resolvePath,
  types,
} from '@jbrowse/mobx-state-tree'

import type {
  IDisposer,
  IStateTreeNode,
  Instance,
} from '@jbrowse/mobx-state-tree'

const MAX_HISTORY_LENGTH = 20

/**
 * The one thing a whole-tree apply asks of its target beyond being a node: a
 * chance to take out, through a door that already knows how, the nodes the
 * incoming snapshot is about to destroy where they stand.
 *
 * Duck-typed because core cannot import product-core, where the session's views
 * and their teardown live. Anything else this is pointed at leaves it undefined
 * and the call is a no-op.
 */
interface SnapshotTarget extends IStateTreeNode {
  takeOutViewsMissingFrom?: (snapshot: unknown) => void
}

/**
 * A change that also writes outside the target, such as deleting a track from
 * the config: `redo` makes it, `undo` takes it back, and undo and redo run them
 * before applying the target's snapshot, which cannot carry that part.
 */
export interface HistoryStep {
  redo: () => void
  undo: () => void
}

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
    steps: [] as (HistoryStep | undefined)[],
    notTrackingUndo: false,
    hasPendingRecord: false,
  }))
  .views(self => ({
    get canUndo() {
      return (
        (self.undoIdx > 0 || self.hasPendingRecord) && !self.notTrackingUndo
      )
    },
    get canRedo() {
      return (
        self.undoIdx < self.history.length - 1 &&
        !self.hasPendingRecord &&
        !self.notTrackingUndo
      )
    },
  }))
  .actions(self => {
    let targetStore: SnapshotTarget | undefined
    let snapshotDisposer: IDisposer | undefined
    let skipNextUndoState = false
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    // When the last patch arrived, so one armed timer can decide on its own
    // whether the store has gone quiet — see `armRecording`.
    let lastPatchMs = 0

    const debounceMs = 300

    /**
     * Record a snapshot once the target has been quiet for {@link debounceMs}.
     *
     * A debounce that re-times itself rather than one that is torn down and
     * rebuilt per patch: a wheel zoom writes the view on every animation frame,
     * and clearing plus reinstalling a timer for each of those patches was 320
     * timer installs over a ten-second gesture. An armed timer that finds the
     * store still busy re-arms for the remaining wait instead, so a burst of any
     * length costs one timer.
     */
    const armRecording = (record: () => void) => {
      lastPatchMs = Date.now()
      const fire = () => {
        const quietFor = Date.now() - lastPatchMs
        if (quietFor < debounceMs) {
          debounceTimer = setTimeout(fire, debounceMs - quietFor)
        } else {
          debounceTimer = undefined
          record()
        }
      }
      debounceTimer ??= setTimeout(fire, debounceMs)
    }

    /**
     * Apply `history[undoIdx]` to the target without recording it. The flag
     * brackets the whole `applySnapshot` — patches are emitted synchronously
     * inside it, and there are as many as there are changed leaves — and is
     * lowered in a `finally` so a rejected snapshot can't leave recording off
     * for good. Lowering it here rather than in the patch handler is the point:
     * the handler cannot tell the last patch of an applySnapshot from the first
     * patch of the user's next edit.
     *
     * A local function, not an action, so it stays off the model's API.
     */
    function applyHistoryState(index: number, outside?: () => void) {
      if (!targetStore) {
        return
      }
      const snapshot = self.history[index]
      skipNextUndoState = true
      try {
        outside?.()
        // ADR-069. `applySnapshot` reconciles by identifier, so it DESTROYS
        // every node the target snapshot does not keep — in place, inside this
        // action, with the components still mounted over them and the action's
        // reactions due at its `endBatch`. That is the sequence `removeView`
        // detaches to avoid, reached through a door it does not cover, so a
        // view leaving by undo goes out the same one first.
        //
        // Inside the flag, and that is the point of taking the snapshot above:
        // a detach patches the tree, and outside the bracket it would be
        // recorded as an undoable step of its own and shift the history under
        // the index we are applying.
        targetStore.takeOutViewsMissingFrom?.(snapshot)
        applySnapshot(targetStore, snapshot)
      } finally {
        skipNextUndoState = false
      }
    }

    let recordPending: (() => void) | undefined

    return {
      setHasPendingRecord(value: boolean) {
        self.hasPendingRecord = value
      },
      flushPendingRecord() {
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = undefined
        }
        if (self.hasPendingRecord) {
          self.hasPendingRecord = false
          recordPending?.()
        }
      },
      stopTrackingUndo() {
        self.notTrackingUndo = true
      },
      resumeTrackingUndo() {
        self.notTrackingUndo = false
      },
      addUndoState(snapshot: unknown, step?: HistoryStep) {
        if (self.notTrackingUndo) {
          return
        }
        self.history.splice(self.undoIdx + 1)
        self.steps.splice(self.undoIdx + 1)
        self.history.push(snapshot)
        self.steps.push(step)
        if (self.history.length > MAX_HISTORY_LENGTH) {
          self.history.shift()
          self.steps.shift()
        }
        self.undoIdx = self.history.length - 1
      },
      /**
       * Make `step`'s change now, as one history entry of its own, whose undo
       * and redo replay the step before applying the target's snapshot.
       */
      record(step: HistoryStep) {
        this.flushPendingRecord()
        step.redo()
        if (targetStore) {
          if (debounceTimer) {
            clearTimeout(debounceTimer)
            debounceTimer = undefined
          }
          self.hasPendingRecord = false
          this.addUndoState(getSnapshot(targetStore), step)
        }
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
       * Start recording history for the target store. Runs again whenever the
       * root replaces the session node, so it must be idempotent: it disposes
       * the previous registration and resets the history, because `history` is
       * volatile while `undoIdx` is a persisted prop, and old session snapshots
       * kept would let undo apply them to the new session.
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
        self.steps = []
        self.undoIdx = -1
        self.hasPendingRecord = false

        // read the target's current state rather than a snapshot captured per
        // change: any change inside the debounce window re-times it, so when it
        // does fire the two agree
        const record = () => {
          this.setHasPendingRecord(false)
          if (targetStore) {
            this.addUndoState(getSnapshot(targetStore))
          }
        }
        recordPending = record

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

          // undo/redo raises this flag around its applySnapshot, so the state
          // it applies is never recorded as an undoable action of its own.
          // Cancel any debounce still pending from the change being undone
          // while we're here. The flag is lowered by undo/redo once
          // applySnapshot has returned, NOT on the first patch: applySnapshot
          // emits one patch per changed leaf, so lowering it here left every
          // patch after the first to schedule a recording of the undone state —
          // which truncated the forward history (redo went dead) and re-pushed
          // the state just restored, so the next undo landed on it again and
          // appeared to do nothing.
          if (skipNextUndoState) {
            if (debounceTimer) {
              clearTimeout(debounceTimer)
              debounceTimer = undefined
            }
            this.setHasPendingRecord(false)
            return
          }

          if (!self.hasPendingRecord) {
            this.setHasPendingRecord(true)
          }
          armRecording(record)
        })

        this.addUndoState(getSnapshot(targetStore))
      },
      undo() {
        this.flushPendingRecord()
        if (self.undoIdx <= 0) {
          return
        }
        const step = self.steps[self.undoIdx]
        self.undoIdx--
        applyHistoryState(self.undoIdx, step?.undo)
      },
      redo() {
        this.flushPendingRecord()
        if (self.undoIdx >= self.history.length - 1) {
          return
        }
        self.undoIdx++
        applyHistoryState(self.undoIdx, self.steps[self.undoIdx]?.redo)
      },
    }
  })

function isTimeTraveller(
  thing: unknown,
): thing is Instance<typeof TimeTraveller> {
  return isStateTreeNode(thing) && getType(thing) === TimeTraveller
}

/**
 * Make `step`'s change, recorded as one undoable entry when `root` keeps a
 * history; a root without one (the embedded products) just makes it.
 */
export function recordStep(root: object, step: HistoryStep) {
  const history = 'history' in root ? root.history : undefined
  if (isTimeTraveller(history)) {
    history.record(step)
  } else {
    step.redo()
  }
}

export default TimeTraveller

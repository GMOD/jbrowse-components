import { createFollowAnswerCache } from './followAnswerCache.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { FollowAnswerCache } from './followAnswerCache.ts'
import type { FollowTransform } from './followTransform.ts'

// What one settle decided: which block places this level, which axis it was
// picked on, and the affine shortcut the frame pass may take until the next
// settle. One object because these are only correct TOGETHER — a transform left
// behind by a previous `feat` maps the window through the wrong block — and as
// loose fields on the state that invariant rested on their being assigned next
// to each other.
export interface LevelPick {
  feat: FeatPos
  display: LinearSyntenyDisplayModel
  toMate: boolean
  // Absent for an envelope answer. That is a union several blocks contributed
  // to, so it carries no one strand, and a forward transform built from one
  // placed the row mirrored inside an inverted alignment until the next settle.
  transform?: FollowTransform
}

// Not observable: the exact pass writes this every pass, so an observable would
// make it a dependency of the run that writes it and re-enter forever.
export interface FollowLevelState {
  pick?: LevelPick
  // Latest-wins: the RPC is not ordered, so a slow earlier resolve can land
  // after a fast later one and park the row at a window already left. Bumped
  // once per PASS per level rather than once per resolve, so that a pass which
  // decides the row holds also invalidates what is in flight.
  seq: number
  answer: FollowAnswerCache
  // Per level, not per view: a level that can never resolve would otherwise be
  // re-reported every settle, its message having been cleared by a level that
  // resolves fine.
  lastErrorMessage?: string
  // Where the row was and where the last navigation sent it, so a repeat of the
  // same pair can be recognised as a navigation that achieved nothing. Cleared
  // the moment the row arrives — see `navSignature`.
  lastNav?: string
}

/**
 * One state per synteny level, KEYED BY THE LEVEL NODE rather than its index.
 * `reconcileLevels` pops a level when a genome row is removed, and by index the
 * entry outlived it: re-add the row and the fresh level inherited the dead
 * one's incumbent feature and cached transform. A WeakMap is also the whole of
 * the pruning story — the destroyed node was the only key that reached its
 * entry.
 *
 * Generic in the key because nothing here looks inside a level. All it needs is
 * an object identity that dies with the row.
 */
export function createFollowLevelStates<Level extends object>() {
  let states = new WeakMap<Level, FollowLevelState>()
  let generation = 0
  return {
    // Which reset of the store an answer was planned under. `seq` cannot say
    // it: dropping the map leaves an in-flight `execute` holding a state object
    // nobody will bump again, so its own latest-wins check goes on passing.
    get generation() {
      return generation
    },
    get(level: Level) {
      let state = states.get(level)
      if (!state) {
        state = { seq: 0, answer: createFollowAnswerCache() }
        states.set(level, state)
      }
      return state
    },
    // What the last settle chose, for the frame pass — which only steers by a
    // decision the exact pass has already made, and so must not mint state of
    // its own for a level that pass has never reached.
    pickFor(level: Level) {
      return states.get(level)?.pick
    },
    // switching the mode off drops every pick, cached transform, in-flight
    // answer and reported error at once
    clear() {
      states = new WeakMap()
      generation++
    },
  }
}

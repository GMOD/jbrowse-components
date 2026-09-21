import { createFollowAnswerCache } from './followAnswerCache.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import type { FollowAnswerCache } from './followAnswerCache.ts'
import type { FollowTransform } from './followTransform.ts'
import type { SpreadDecision } from './spreadDecision.ts'

// What one settle decided, as one object: a transform left behind by a
// previous `feat` maps the window through the wrong block.
export interface LevelPick {
  feat: FeatPos
  display: LinearSyntenyDisplayModel
  // the contig the row was last placed on, which rung 2's vote leans toward
  target: string
  // absent for an envelope answer, which carries no one strand
  transform?: FollowTransform
}

// Kept across settles, and a miss is recorded too, or a block with no CIGAR is
// asked about every settle.
export interface LevelCigarMap {
  featureId: string
  value?: SyntenyCigarMapResult
}

// Not observable: the exact pass writes this every pass, and an observable
// would make it a dependency of the run that writes it.
export interface FollowLevelState {
  // the axis the pick and the spread decision were made on
  toMate?: boolean
  pick?: LevelPick
  map?: LevelCigarMap
  mapPending?: string
  // latest-wins, bumped once per pass per level
  seq: number
  answer: FollowAnswerCache
  lastErrorMessage?: string
  spread?: SpreadDecision
  // each anchor contig's mate contig at the last spread, which rung 3's vote
  // leans toward
  spreadTargets?: ReadonlyMap<string, string>
  // the last navigation as from>to, so a repeat can be refused
  lastNav?: string
  // the orientation decision the row was last flipped for
  orientedKey?: string
}

/**
 * One state per synteny level, keyed by the level node rather than its index,
 * so a re-added row inherits nothing from a removed level's entry.
 */
export function createFollowLevelStates<Level extends object>() {
  let states = new WeakMap<Level, FollowLevelState>()
  let generation = 0
  // one per generation rather than per request: a later window inside the same
  // block still wants the CIGAR map already in flight for it
  let controller: AbortController | undefined
  function get(level: Level) {
    let state = states.get(level)
    if (!state) {
      state = { seq: 0, answer: createFollowAnswerCache() }
      states.set(level, state)
    }
    return state
  }
  return {
    // which reset of the store an answer was planned under, which `seq` cannot
    // say for a state object `clear()` orphaned
    get generation() {
      return generation
    },
    get,
    // drops the decisions made facing the other way
    facing(level: Level, toMate: boolean) {
      const state = get(level)
      if (state.toMate !== toMate) {
        state.toMate = toMate
        state.pick = undefined
        state.spread = undefined
        state.spreadTargets = undefined
      }
      return state
    },
    // for the frame pass, which mints no state
    peek(level: Level, toMate: boolean) {
      const state = states.get(level)
      return state?.toMate === toMate ? state : undefined
    },
    get signal(): AbortSignal {
      controller ??= new AbortController()
      return controller.signal
    },
    clear() {
      states = new WeakMap()
      generation++
      controller?.abort()
      controller = undefined
    },
  }
}

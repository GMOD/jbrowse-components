import { createFollowAnswerCache } from './followAnswerCache.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import type { FollowAnswerCache } from './followAnswerCache.ts'
import type { FollowTransform } from './followTransform.ts'
import type { SpreadDecision } from './spreadDecision.ts'

// What one settle decided: which block places this level, and the affine
// shortcut the frame pass may take until the next settle. One object because these are only correct TOGETHER — a transform left
// behind by a previous `feat` maps the window through the wrong block — and as
// loose fields on the state that invariant rested on their being assigned next
// to each other.
export interface LevelPick {
  feat: FeatPos
  display: LinearSyntenyDisplayModel
  // The contig this level last placed the row on, which the envelope's vote
  // between the mate contigs under the window is biased toward. Here rather
  // than beside the state because it is the same decision the `feat` above is:
  // dropping the pick to hold the row drops the bias with it, and a fresh
  // window then chooses freely.
  target: string
  // Absent for an envelope answer. That is a union several blocks contributed
  // to, so it carries no one strand, and a forward transform built from one
  // placed the row mirrored inside an inverted alignment until the next settle.
  transform?: FollowTransform
}

// One block's CIGAR reduced to bend points, and the block it was built for.
// KEPT ACROSS SETTLES, unlike the pick beside it: a map describes the whole
// block, so every window inside it reads the same one and re-asking per settle
// would be the RPC-per-window shape this exists to get out of.
//
// A miss is recorded rather than dropped. A block with no CIGAR has no map and
// never will, and without the entry the level asks again every settle for an
// answer that cannot arrive.
export interface LevelCigarMap {
  featureId: string
  value?: SyntenyCigarMapResult
}

// Not observable: the exact pass writes this every pass, so an observable would
// make it a dependency of the run that writes it and re-enter forever.
export interface FollowLevelState {
  // which way the level last followed: toward the mate row or away from it.
  // The pick and the spread decision were made on that axis and say nothing
  // about the other
  toMate?: boolean
  pick?: LevelPick
  map?: LevelCigarMap
  // the block a map is in flight for, so a settle inside a block already being
  // asked about does not ask again
  mapPending?: string
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
  // The multi-contig rung's own decision, made by the exact pass — or by the
  // frame pass when a drag reaches several windows before any settle has — and
  // then FOLLOWED rather than re-made per frame. The two placements it chooses
  // between are the furthest apart this subsystem can put a row, so a frame
  // pass free to re-decide would flip between them across a threshold the user
  // is panning along — and it also carries the hysteresis, which needs a
  // previous answer to be hysteresis at all.
  spread?: SpreadDecision
  // Each anchor contig's mate contig at the last spread, which that rung's vote
  // leans toward the way a pick's `target` leans the single-contig one
  spreadTargets?: ReadonlyMap<string, string>
  // Where the row was and where the last navigation sent it, so a repeat of the
  // same pair can be recognised as a navigation that achieved nothing. Cleared
  // the moment the row arrives — see `navSignature`.
  lastNav?: string
  // The orientation decision the row was last flipped for — the block or the
  // vote, and the anchor's own orientation. Applied ONCE per key: a row the
  // user flips by hand afterwards stays flipped until the decision changes,
  // which is what keeps the manual flip from needing an anchor take.
  orientedKey?: string
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
  // The epoch's own signal, created on first use and aborted by `clear()`.
  //
  // AN EPOCH, NOT A ROTATION. A rotation is for a fetch with a latest-wins
  // guard, and the CIGAR map explicitly rejects latest-wins — a later window
  // inside the same block still wants the map already in flight for it — so
  // rotating would stop one level's still-wanted map the moment another level
  // asked. What makes an in-flight map stale is the store being dropped
  // underneath it, which is what `generation` says, so the signal's lifetime is
  // exactly one generation.
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
    // Which reset of the store an answer was planned under. `seq` cannot say
    // it: dropping the map leaves an in-flight `execute` holding a state object
    // nobody will bump again, so its own latest-wins check goes on passing.
    get generation() {
      return generation
    },
    get,
    // The state for a pass following `toMate`, with the decisions made facing
    // the other way dropped: a pick and a spread handed across a flip were
    // the next plan's incumbents on an axis they were never made on.
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
    // What the last pass facing `toMate` decided, for the frame pass, which
    // steers only by decisions already made and so mints no state of its own:
    // undefined is its cue to decide for itself.
    peek(level: Level, toMate: boolean) {
      const state = states.get(level)
      return state?.toMate === toMate ? state : undefined
    },
    // The signal every request planned under this generation carries, so that
    // dropping the store stops the work as well as the answer.
    get signal(): AbortSignal {
      controller ??= new AbortController()
      return controller.signal
    },
    // switching the mode off drops every pick, cached transform, in-flight
    // answer and reported error at once, and aborts the requests behind them:
    // bumping `generation` alone discards the RESULT while the worker goes on
    // reading the whole region out of the file for it.
    clear() {
      states = new WeakMap()
      generation++
      controller?.abort()
      controller = undefined
    },
  }
}

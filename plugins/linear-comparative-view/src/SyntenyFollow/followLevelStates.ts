import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import { createFollowAnswerCache } from './followAnswerCache.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import type { FollowAnswerCache } from './followAnswerCache.ts'
import type { FollowRowWindows } from './followHandNudge.ts'
import type { FollowTransform } from './followTransform.ts'
import type { SpreadDecision } from './spreadDecision.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

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
  // The multi-contig rung's own decision, made by the exact pass and FOLLOWED
  // by the frame pass rather than re-made there. The two placements it chooses
  // between are the furthest apart this subsystem can put a row, so a frame pass
  // free to re-decide would flip between them across a threshold the user is
  // panning along — and it also carries the hysteresis, which needs a previous
  // answer to be hysteresis at all.
  spread?: SpreadDecision
  // Where the row was and where the last navigation sent it, so a repeat of the
  // same pair can be recognised as a navigation that achieved nothing. Cleared
  // the moment the row arrives — see `navSignature`.
  lastNav?: string
  // The orientation decision the row was last flipped for — the block or the
  // vote, and the anchor's own orientation. Applied ONCE per key: a row the
  // user flips by hand afterwards stays flipped until the decision changes,
  // which is what keeps the manual flip from needing an anchor take.
  orientedKey?: string
  // What the level's two rows were showing at the previous pass, which is the
  // whole of what tells a hand nudge from an ordinary placement — see
  // `handNudged`.
  lastWindows?: FollowRowWindows
  // Whether the previous pass moved the row itself, so that the row being
  // somewhere new at this one is not read as the user's doing. Set by whichever
  // rung placed it and cleared by the next plan, which is the pass it is about.
  movedRow?: boolean
  // Per level and per follow-on: the snap is explained once. `clear()` drops it
  // with everything else, so switching the mode off and on says it again — but
  // a message per nudge is a message the reader has already read, and the
  // snackbar it goes to carries actions and so does not dedup on its own.
  nudgeReported?: boolean
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
  // The epoch's own stop token, minted on first use and stopped by `clear()`.
  //
  // AN EPOCH, NOT A ROTATION. A rotation is for a fetch with a latest-wins
  // guard, and the CIGAR map explicitly rejects latest-wins — a later window
  // inside the same block still wants the map already in flight for it — so
  // rotating would stop one level's still-wanted map the moment another level
  // asked. What makes an in-flight map stale is the store being dropped
  // underneath it, which is what `generation` says, so the token's lifetime is
  // exactly one generation.
  let stopToken: StopToken | undefined
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
    // What the exact pass decided about the multi-contig rung, for the frame
    // pass to follow. Like `pickFor`, it does not mint: a level that pass has
    // never reached has made no decision, and the frame pass spreads, which is
    // what this rung did before the decision existed.
    spreadFor(level: Level) {
      return states.get(level)?.spread
    },
    // The map only if it is THIS block's. `cigarMapSpan` re-checks the block's
    // coordinates, which is the check that matters, but a map is per block and
    // the id is what says so — the coordinates alone would accept the map of a
    // different alignment sharing an extent, which an all-vs-all file has by
    // the row.
    mapFor(level: Level, featureId: string) {
      const map = states.get(level)?.map
      return map?.featureId === featureId ? map.value : undefined
    },
    // The token every request planned under this generation carries, so that
    // dropping the store stops the work as well as the answer.
    get stopToken(): StopToken {
      const token = stopToken ?? createStopToken()
      stopToken = token
      return token
    },
    // switching the mode off drops every pick, cached transform, in-flight
    // answer and reported error at once — and now stops the requests behind
    // them, which the sentence above claimed before it was true: bumping
    // `generation` discarded the RESULT while the worker went on reading the
    // whole region out of the file for it.
    clear() {
      states = new WeakMap()
      generation++
      if (stopToken) {
        stopStopToken(stopToken)
        stopToken = undefined
      }
    },
  }
}

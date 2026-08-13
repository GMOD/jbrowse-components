import { getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { navToResolvedSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { alreadyShowing } from './alreadyShowing.ts'
import { followAnchorWindow } from './followAnchorWindow.ts'
import { followFrameSpan } from './followFrameSpan.ts'
import { followTransform } from './followTransform.ts'
import { planFollowStep } from './planFollowStep.ts'
import { positionViewOnSpan } from './positionViewOnSpan.ts'
import { resolveFollowSpan } from './resolveFollowSpan.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowTransform } from './followTransform.ts'
import type { FollowStep } from './planFollowStep.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/** One synteny level resolved into the rows a follow moves it between. */
export interface FollowPair {
  level: { linearSyntenyDisplays: LinearSyntenyDisplayModel[]; level: number }
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  toMate: boolean
  mateAssembly?: string
}

export interface SyntenyFollowHost extends IStateTreeNode {
  followSynteny: boolean
  followPairs: FollowPair[]
  setFollowUnaligned: (arg: boolean) => void
  setFollowApproximate: (arg: boolean) => void
}

/**
 * Per-level state the follow keeps between passes.
 *
 * PLAIN JS, DELIBERATELY NOT OBSERVABLE AND NOT ON THE MODEL. The autorun writes
 * this on every pass; an observable would make it a dependency of the very run
 * that writes it, and the follow would re-enter itself forever. It is also not
 * state a session should persist — `featureId` is only comparable within one
 * fetch of one LOD tier, and `transform` describes the window it was measured
 * over.
 */
interface LevelState {
  // the alignment this level followed last, for pickFollowFeature's hysteresis
  featureId?: string
  // and the alignment itself, plus the display it came from, so the per-frame
  // pass can place the row without re-picking one — see windowInsideFeat
  feat?: FeatPos
  display?: LinearSyntenyDisplayModel
  // which way the level ran when the three above were measured. Moving the
  // anchor across a level flips `toMate`, and all three are direction-bound.
  toMate?: boolean
  // latest-wins guard. A pan issues one resolve per settled position and the RPC
  // is not ordered, so a slow earlier one can land after a fast later one and
  // park the panel at a window the user has already left.
  seq: number
  // the last exact answer as a local mapping, which is what the per-frame pass
  // steers by between resolves. See followTransform.
  transform?: FollowTransform
  // the last thing asked, and the asking of it. See answerFor.
  answerKey?: string
  answer?: Promise<ResolvedSpan>
}

/**
 * What the exact answer depends on, and undefined where it depends on more than
 * the step can name: the envelope is the union of every loaded block, so an
 * unchanged window and alignment still resolve differently once more of them
 * arrive — and it costs no RPC, so there is nothing to save by keeping it.
 */
function stepKey(step: FollowStep) {
  const { display, feat, toMate, window, windowInsideFeat } = step
  const { refName, start, end } = window
  return windowInsideFeat
    ? `${display.id} ${feat.id} ${toMate} ${refName}:${start}-${end}`
    : undefined
}

/**
 * The answer for one step, asked at most once.
 *
 * A SETTLE WAKES THIS PASS THREE TIMES with the same question: the moving row's
 * refetch, and applying the answer, which flushes that row's coarse blocks —
 * read here to know where the row actually is. Each was another walk of the
 * same CIGAR in the worker.
 *
 * The promise rather than the span, so the wakes arriving before it lands share
 * the request in flight. Every pass still awaits it and runs its own
 * `alreadyShowing` check against the window IT read, which is what keeps a row
 * nudged by hand between passes from being written off as already in place.
 *
 * A rejection is dropped, so the next wake retries rather than replaying one
 * failure for as long as the window sits still.
 */
function answerFor(
  state: LevelState,
  key: string | undefined,
  step: FollowStep,
) {
  const shared =
    key !== undefined && key === state.answerKey ? state.answer : undefined
  if (shared) {
    return shared
  }
  const request = resolveFollowSpan(step)
  if (key !== undefined) {
    state.answerKey = key
    state.answer = request
    request.catch(() => {
      if (state.answer === request) {
        state.answerKey = undefined
        state.answer = undefined
      }
    })
  }
  return request
}

/**
 * Keep the non-anchor genome rows on the region that aligns to the anchor row.
 *
 * The continuous form of the band context menu's "Move bottom panel to the
 * matching region", resolved the same way: the anchor's visible WINDOW mapped
 * through the alignments, as a span rather than a midpoint, so the moved row
 * matches the anchor's scale and the ribbons stay near-vertical. What differs
 * is that nobody clicks a band — the alignment is picked by overlap
 * (`planFollowStep`) and a CIGAR-less one is interpolated across rather than
 * refused (`interpolateFollowSpan` says why those two answer that differently).
 *
 * TWO PASSES, and the split is the whole design.
 *
 * The EXACT pass runs on the debounced window (`coarseDynamicBlocks`, ~500ms
 * behind the pointer), because it costs an RPC and resolving per pointer-move
 * would issue one per frame to park a row the user is still moving away from.
 * It also reads what is DRAWN rather than what is current: after a large jump
 * the display can briefly still hold the previous window's features, which are
 * the ones on screen. The pass re-runs when the fetch lands and corrects itself.
 *
 * The PER-FRAME pass fills in the motion between those. Without it the followed
 * row does not lag — it sits perfectly still through a drag and jumps once, half
 * a second late, which is what "jumpy" means here.
 */
export function installSyntenyFollow(self: SyntenyFollowHost) {
  const levelStates = new Map<number, LevelState>()
  let lastErrorMessage: string | undefined

  function stateFor(level: number) {
    let state = levelStates.get(level)
    if (!state) {
      state = { seq: 0 }
      levelStates.set(level, state)
    }
    return state
  }

  async function execute(
    pair: FollowPair,
    step: FollowStep,
    movingWindow: FollowWindow | undefined,
  ) {
    const { movingView } = pair
    const state = stateFor(pair.level.level)
    const seq = ++state.seq
    const span = await answerFor(state, stepKey(step), step)
    // superseded while the resolve was in flight, the view went away, or the
    // mode was switched off — the last of which supersedes nothing on its own,
    // since it issues no resolve to bump `seq` with
    if (
      seq !== state.seq ||
      !isAlive(self) ||
      !isAlive(movingView) ||
      !self.followSynteny
    ) {
      return
    }
    // consecutive duplicates, not every message ever seen: a failure that comes
    // back after the follow worked again is news
    lastErrorMessage = undefined
    state.featureId = step.feat.id
    state.feat = step.feat
    state.display = step.display
    state.toMate = step.toMate
    // Refreshed on every resolve, not only the ones that move something, since
    // this is what the per-frame pass steers by.
    //
    // ONLY FROM THE SINGLE-BLOCK ANSWER. An envelope maps the window onto a
    // union several blocks contributed to, so there is no one strand to carry —
    // and a forward transform cached from one, applied after a zoom in to an
    // INVERTED alignment, placed the row mirrored inside that block until the
    // next settle. Dropping it falls the frame pass back to interpolating the
    // block, which reads the strand off the block itself.
    state.transform = step.windowInsideFeat
      ? followTransform(
          step.window,
          span,
          // an inverted correspondence runs the other way, and the resolved
          // span is always min..max, so the direction cannot be read back off it
          step.feat.strand === -1,
        )
      : undefined
    if (alreadyShowing(movingWindow, span)) {
      return
    }
    await navToResolvedSpan(movingView, span)
  }

  function reportError(e: unknown) {
    // An RPC outliving the view it was issued for rejects into here, and
    // `getSession` throws on a node with no parent — out of a catch handler,
    // where it becomes an unhandled rejection rather than a notification
    if (!isAlive(self)) {
      return
    }
    // A follow that cannot resolve usually cannot resolve repeatedly — an
    // assembly whose refName the moving row does not have fails the same way on
    // every pan — and a snackbar per settle would bury the app in identical
    // notifications for a background action nobody asked to run.
    const message = `${e}`
    if (message !== lastErrorMessage) {
      lastErrorMessage = message
      getSession(self).notifyError(message, e)
    }
  }

  addDisposer(
    self,
    autorun(
      function syntenyFollowAutorun() {
        if (!self.followSynteny) {
          // Nothing switched off should greet the next person who switches it
          // back on: not the header's warning, not a cached transform (the
          // frame pass wakes the moment the flag flips and would place the row
          // from it for ~500ms), and not a suppressed error.
          self.setFollowUnaligned(false)
          self.setFollowApproximate(false)
          levelStates.clear()
          lastErrorMessage = undefined
          return
        }
        // Every observable read happens in this synchronous pass, so the
        // dependency set is complete before anything awaits. `execute` is async
        // and its reads would not be tracked.
        const work: [FollowPair, FollowStep, FollowWindow | undefined][] = []
        // Levels that HAVE alignments loaded and still found none over the
        // window. Loading is deliberately not counted: a level whose fetch has
        // not landed has no answer YET rather than no answer, and flagging it
        // would blink a warning on every pan.
        let unaligned = false
        let approximate = false
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          const window = followAnchorWindow(stayingView.coarseDynamicBlocks)
          if (!window) {
            continue
          }
          // Reading the moving row here makes it a DEPENDENCY, which is
          // deliberate: it is what re-asserts the follow over a row the user
          // nudged by hand. Debounced rather than live, for the same reason the
          // anchor is.
          const movingWindow = followAnchorWindow(
            movingView.coarseDynamicBlocks,
          )
          const step = planFollowStep({
            displays: level.linearSyntenyDisplays,
            window,
            toMate,
            mateAssembly,
            incumbentId: stateFor(level.level).featureId,
          })
          if (step) {
            work.push([pair, step, movingWindow])
            // off the plan rather than the answer, so it lands in this
            // synchronous pass. `hasCigar` is per-FETCH, so a file mixing them
            // under-reports here — no worse than the silence this replaces.
            if (!step.windowInsideFeat || !step.hasCigar) {
              approximate = true
            }
          } else if (level.linearSyntenyDisplays.some(d => d.featureData)) {
            // The row holds position and picks the follow back up when the
            // anchor pans into aligned sequence again — said out loud, since a
            // row that stops tracking silently is the same picture as a broken
            // follow.
            unaligned = true
          }
        }
        // Written, never read here — reading either would make the autorun a
        // dependency of its own write. The header is the only consumer.
        self.setFollowUnaligned(unaligned)
        self.setFollowApproximate(approximate)
        for (const [pair, step, movingWindow] of work) {
          execute(pair, step, movingWindow).catch(reportError)
        }
      },
      { name: 'SyntenyFollow' },
    ),
  )

  // The per-frame half, and the reason the follow moves rather than teleports.
  //
  // IT REPLANS AGAINST THE LIVE WINDOW rather than extrapolating the last exact
  // answer, and only the RPC is left out. Extrapolating was the first version:
  // it tracked a drag perfectly and then snapped on settle, by 43% of a screen
  // at 5 Mb on grape/peach and 66% at 20 Mb. Past the width of a single
  // alignment the answer is the ENVELOPE, which is not an affine function of
  // the window — blocks enter and leave it as the anchor pans, so its edges
  // move in steps no cached mapping can predict. Recomputing it costs nothing
  // here: main-thread arithmetic over arrays the display already holds. The
  // cached transform is kept for the one case it models well, a window inside
  // one alignment, which measured 9.8% and is mostly the CIGAR detail.
  //
  // READS EACH LEVEL'S STAYING ROW AND THE LOADED FEATURES, NEVER ITS MOVING
  // ROW, which this pass writes. In a stack of three or more an interior row is
  // both — placed by the level nearer the anchor and read by the one beyond it
  // — which is why `followPairs` comes back ordered OUTWARD FROM THE ANCHOR: the
  // nearer level's write lands before the farther level reads it, so one pass
  // settles the stack instead of one pass per level.
  addDisposer(
    self,
    autorun(
      function syntenyFollowFrameAutorun() {
        if (!self.followSynteny) {
          return
        }
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          const window = followAnchorWindow(
            stayingView.dynamicBlocks.contentBlocks,
          )
          if (!window) {
            continue
          }
          // The block the last settle chose, rather than re-picking one: that
          // costs a scan of every loaded block, and this pass already pays for
          // one in `followWindowMapping`. Nothing is placed until the first
          // settle populates it.
          //
          // Checked against its direction, since moving the anchor across this
          // level flips `toMate` and the cached block was picked on the other
          // axis; and against the display's liveness, since hiding the synteny
          // track destroys the node and reading `featureData` off it throws
          // from inside this autorun.
          const cached = levelStates.get(level.level)
          const state = cached?.toMate === toMate ? cached : undefined
          const feat = state?.feat
          const display = state?.display
          const data =
            display && isAlive(display) ? display.featureData : undefined
          if (!state || !feat || !data) {
            continue
          }
          const span = followFrameSpan({
            feat,
            data,
            window,
            toMate,
            mateAssembly,
            transform: state.transform,
          })
          if (span) {
            positionViewOnSpan(movingView, span)
          }
        }
      },
      { name: 'SyntenyFollowFrame' },
    ),
  )
}

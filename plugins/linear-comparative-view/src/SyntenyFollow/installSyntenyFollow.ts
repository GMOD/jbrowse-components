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
 * What the exact answer depends on — undefined where it depends on more than
 * the step can name.
 *
 * The single-block answer is a function of the alignment, the window and the
 * direction: one CIGAR walk, or one interpolation across the block. The
 * envelope is the union of every loaded block, so an unchanged window and
 * alignment still resolve differently once more of them arrive — and it costs
 * no RPC, so there is nothing to save by holding on to it.
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
 * A SETTLE WAKES THIS PASS THREE TIMES, all with the same question. The moving
 * row's refetch is one, and applying the answer is another two — the nav
 * flushes that row's coarse blocks, which this pass reads to know where the row
 * actually is. Each was a second and third walk of the same CIGAR in the
 * worker.
 *
 * The promise rather than the resolved span, so the two of those that arrive
 * before the first one lands share the request in flight instead of issuing
 * their own. Every pass still awaits it and still runs its own `alreadyShowing`
 * check afterwards, against the window IT read — which is what keeps a row
 * nudged by hand between passes from being written off as already in place.
 *
 * A rejection is dropped rather than kept, so the next wake retries instead of
 * replaying one failure for as long as the window sits still.
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
 * This is the continuous form of the band context menu's "Move bottom panel to
 * the matching region", and it resolves the same way: the anchor's visible
 * WINDOW mapped through the alignments, as a span rather than a midpoint, so the
 * moved row matches the anchor's scale and the ribbons between them stay
 * near-vertical. What differs is that nobody clicks a band — the alignment is
 * picked by overlap with the anchor window (`planFollowStep`), and a CIGAR-less
 * block is interpolated across rather than refused (`interpolateFollowSpan` says
 * why those two answer it differently).
 *
 * TWO PASSES, and the split is the whole design.
 *
 * The EXACT pass runs on the debounced window (`coarseDynamicBlocks`, ~500ms
 * behind the pointer), because it costs an RPC and resolving per pointer-move
 * would issue one per frame to park a row the user is still moving away from.
 * It also reads what is DRAWN rather than what is current: the features scanned
 * are the ones the display holds, which after a large jump can briefly be the
 * previous window's — the same ones still painted on screen. Following those is
 * honest, the fetch window carries a pan buffer so the common case is not stale,
 * and the pass re-runs when the fetch lands and corrects itself.
 *
 * The PER-FRAME pass then fills in the motion between those, steering by the
 * cached transform alone. Without it the followed row does not lag — it sits
 * perfectly still through a drag and jumps once, half a second late, which is
 * what "jumpy" means here. See followTransform.
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
    // Cached even when the row is already in place: this is what the per-frame
    // pass steers by, so it has to be refreshed on every resolve rather than
    // only on the ones that move something.
    //
    // ONLY FROM THE SINGLE-BLOCK ANSWER, which is the only case the per-frame
    // pass applies it to. An envelope resolve maps the window onto a union
    // several blocks contributed to, so there is no one strand to carry — and a
    // forward transform cached from one, then applied after a zoom in to an
    // INVERTED alignment, placed the row mirrored inside that block for the
    // ~500ms until the next settle: half a second of motion running the wrong
    // way, in exactly the mode that exists to keep the ribbons vertical.
    // Dropping it instead falls the frame pass back to interpolating the block,
    // which reads the strand off the block itself.
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
    // ONCE PER DISTINCT MESSAGE. A follow that cannot resolve usually cannot
    // resolve repeatedly — an assembly whose refName the moving row does not
    // have keeps failing the same way on every pan — and a snackbar per settle
    // would bury the app in identical notifications for a background action
    // nobody asked to run.
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
          // so the header's warning form does not survive the mode being
          // switched off over unaligned sequence and greet the next person who
          // switches it back on. One write, since `followSynteny` is the only
          // thing this pass reads while off.
          self.setFollowUnaligned(false)
          self.setFollowApproximate(false)
          // and neither does the cache: the frame pass wakes the moment the
          // flag flips back, so a stale transform placed the row for the
          // ~500ms until the first resolve corrected it
          levelStates.clear()
          // same for the error memo — a failure re-triggered deliberately
          // should be reported again
          lastErrorMessage = undefined
          return
        }
        // Every observable read happens in this synchronous pass, so the
        // dependency set is complete before anything awaits. `execute` is async
        // and its reads would not be tracked.
        const work: [FollowPair, FollowStep, FollowWindow | undefined][] = []
        // Levels that HAVE alignments loaded and still found none over the
        // anchor window — the state the header reports, see setFollowUnaligned.
        // Loading is deliberately not counted: a level whose fetch has not
        // landed has no answer yet rather than no answer, and flagging it would
        // blink a warning on every pan.
        let unaligned = false
        // Levels whose placement will be a proportional mapping rather than a
        // CIGAR walk, which interpolateFollowSpan asks its callers to say.
        let approximate = false
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          const window = followAnchorWindow(stayingView.coarseDynamicBlocks)
          if (!window) {
            continue
          }
          // The moving row's own settled window, read here so this pass owns
          // every observable the follow depends on. It makes that row a
          // DEPENDENCY, which is deliberate and is what re-asserts the follow
          // over a row the user nudged by hand. The debounced blocks, not the
          // live ones, for the same reason the anchor uses them: tracking the
          // live position would wake this pass on every frame of a drag. It
          // converges — the nav settles, wakes this once more, and
          // `alreadyShowing` then says there is nothing to do.
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
            // Off the plan rather than the answer, so it lands in this
            // synchronous pass. `hasCigar` is per-FETCH, so a file mixing them
            // under-reports here — no worse than the silence this replaces.
            if (!step.windowInsideFeat || !step.hasCigar) {
              approximate = true
            }
          } else if (level.linearSyntenyDisplays.some(d => d.featureData)) {
            // No alignment over the anchor window. The moving row HOLDS
            // POSITION rather than being sent somewhere invented, and picks the
            // follow back up when the anchor pans into aligned sequence again —
            // reported rather than only silent, since a row that stops tracking
            // with nothing said is the same picture as a broken follow.
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
  // answer, and only the RPC is left out. Extrapolating was the first version
  // and it tracked a drag perfectly and then snapped on settle — measured on
  // grape/peach at 43% of a screen at 5 Mb and 66% at 20 Mb, which is the same
  // complaint one step further along. The reason is structural: past the width
  // of a single alignment the exact answer is the ENVELOPE, and an envelope is
  // not an affine function of the window — blocks enter and leave it as the
  // anchor pans, so its edges move in steps no cached mapping can predict. The
  // envelope is also the half that costs nothing: main-thread arithmetic over
  // typed arrays the display already holds.
  //
  // So the cached transform is kept for exactly the case it models well — a
  // window inside one alignment, where the correspondence IS affine outside the
  // indels and where the RPC's CIGAR walk is the only thing this pass cannot
  // reproduce. That case measured 9.8%, most of it the CIGAR detail.
  //
  // READS EACH LEVEL'S STAYING ROW AND THE LOADED FEATURES, NEVER ITS MOVING
  // ROW. `positionViewOnSpan` writes that row's zoom and offset, so tracking
  // anything on it here would be a dependency on this pass's own write. In a
  // stack of three or more an interior row is both — placed by the level nearer
  // the anchor and read by the one beyond it — which is why `followPairs` comes
  // back ordered OUTWARD FROM THE ANCHOR: the nearer level's write lands before
  // the farther level reads it, so one pass settles the stack instead of one
  // pass per level.
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
          // The block the last settle chose, rather than re-picking one. That
          // choice costs a full scan of every loaded block, and this pass is
          // already paying for one in `followWindowMapping`; a whole-genome
          // PAF's loaded set runs to hundreds of thousands, where each scan is
          // a measurable slice of a frame. Nothing is placed until the first
          // settle populates this, which is a few hundred ms after the mode is
          // switched on.
          //
          // Checked against its direction, since moving the anchor across this
          // level flips `toMate` and the cached block was picked on the other
          // axis; and against the display's liveness, since hiding that synteny
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

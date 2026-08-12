import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { followAnchorWindow } from './followAnchorWindow.ts'
import { applyFollowTransform, followTransform } from './followTransform.ts'
import { planFollowStep } from './planFollowStep.ts'
import { positionViewOnSpan } from './positionViewOnSpan.ts'
import { resolveFollowSpan } from './resolveFollowSpan.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
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
  // latest-wins guard. A pan issues one resolve per settled position and the RPC
  // is not ordered, so a slow earlier one can land after a fast later one and
  // park the panel at a window the user has already left.
  seq: number
  // the last exact answer as a local mapping, which is what the per-frame pass
  // steers by between resolves. See followTransform.
  transform?: FollowTransform
}

// How far the moving panel may already be from the span a follow resolved to
// before it is worth navigating, as a fraction of that span. Two things need
// this to be a tolerance rather than an equality test. A refetch lands on every
// pass and rewakes the autorun, so the ordinary case is re-resolving a panel
// that is ALREADY where it belongs; and navToLocString fits the span to the pane
// rather than landing on it exactly, so the panel never reports back the numbers
// it was given. Without the slack the two of those together renavigate the panel
// indefinitely, each time by a few bp.
const ALREADY_THERE_FRACTION = 0.02

/**
 * Whether the moving row is close enough to `span` that navigating would be
 * churn.
 *
 * WHERE THE ROW ACTUALLY IS, not what the follow last asked for. The two come
 * apart when the user nudges a followed row by hand, and a follow that
 * remembered only its own request would leave the row where the user put it
 * while still reporting itself as following.
 *
 * Pure, over a window the caller read while it was tracking. That is what lets
 * the moving row's settled position be an ordinary DEPENDENCY of the follow —
 * nudge a followed row and, once it settles, the follow wakes and puts it back —
 * rather than something read behind the scheduler's back from an async
 * continuation.
 */
export function alreadyShowing(
  shown: FollowWindow | undefined,
  span: ResolvedSpan,
) {
  if (!shown || shown.refName !== span.refName) {
    return false
  }
  const slack = Math.max((span.end - span.start) * ALREADY_THERE_FRACTION, 1)
  return (
    Math.abs(shown.start - span.start) <= slack &&
    Math.abs(shown.end - span.end) <= slack
  )
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
    const span = await resolveFollowSpan(step)
    // superseded while the resolve was in flight, or the view went away
    if (seq !== state.seq || !isAlive(self) || !isAlive(movingView)) {
      return
    }
    state.featureId = step.feat.id
    // Cached even when the row is already in place: this is what the per-frame
    // pass steers by, so it has to be refreshed on every resolve rather than
    // only on the ones that move something.
    state.transform = followTransform(
      step.window,
      span,
      // an inverted correspondence runs the other way, and the resolved span is
      // always min..max, so the direction cannot be read back off it
      step.windowInsideFeat && step.feat.strand === -1,
    )
    if (alreadyShowing(movingWindow, span)) {
      return
    }
    await movingView.navToLocString(
      assembleLocStringRaw({
        refName: span.refName,
        start: span.start,
        // at least one base, since a zero-width span assembles into an inverted
        // locstring
        end: Math.max(span.start + 1, span.end),
      }),
    )
  }

  function reportError(e: unknown) {
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
          } else if (level.linearSyntenyDisplays.some(d => d.featureData)) {
            // No alignment over the anchor window. The moving row HOLDS
            // POSITION rather than being sent somewhere invented, and picks the
            // follow back up when the anchor pans into aligned sequence again —
            // reported rather than only silent, since a row that stops tracking
            // with nothing said is the same picture as a broken follow.
            unaligned = true
          }
        }
        // Written, never read here — reading it would make the autorun a
        // dependency of its own write. The header is the only consumer.
        self.setFollowUnaligned(unaligned)
        for (const [pair, step, movingWindow] of work) {
          execute(pair, step, movingWindow).catch(reportError)
        }
      },
      { name: 'SyntenyFollow' },
    ),
  )

  // The per-frame half, and the reason the follow moves rather than teleports.
  //
  // It steers by the cached transform alone — no fetch, no RPC, no scan of the
  // loaded blocks, just the anchor's LIVE window through an affine map and one
  // synchronous placement. That is what makes it affordable at pointer rate,
  // and what makes it safe to track the undebounced blocks the exact pass
  // deliberately does not.
  //
  // READS THE ANCHOR ROW AND NOTHING ELSE. `positionViewOnSpan` writes the
  // followed row's zoom and offset, so tracking anything on that row here would
  // be a dependency on this pass's own write.
  addDisposer(
    self,
    autorun(
      function syntenyFollowFrameAutorun() {
        if (!self.followSynteny) {
          return
        }
        for (const { level, stayingView, movingView } of self.followPairs) {
          // READ THE ANCHOR WINDOW BEFORE TESTING THE TRANSFORM, even though the
          // transform is what decides whether it gets used. The transform lives
          // in plain JS, so it notifies nothing: bailing out above this line on
          // the first pass — when no resolve has happened yet and there is
          // none — left the autorun with no dependency on the anchor at all,
          // and it then never ran again. It read as the per-frame pass simply
          // not working, which is what it was.
          const window = followAnchorWindow(
            stayingView.dynamicBlocks.contentBlocks,
          )
          const transform = levelStates.get(level.level)?.transform
          const span =
            window && transform
              ? applyFollowTransform(transform, window)
              : undefined
          if (span) {
            positionViewOnSpan(movingView, span)
          }
        }
      },
      { name: 'SyntenyFollowFrame' },
    ),
  )
}

import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

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
    state.feat = step.feat
    state.display = step.display
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
          // so the header's warning form does not survive the mode being
          // switched off over unaligned sequence and greet the next person who
          // switches it back on. One write, since `followSynteny` is the only
          // thing this pass reads while off.
          self.setFollowUnaligned(false)
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
          const state = levelStates.get(level.level)
          const feat = state?.feat
          const data = state?.display?.featureData
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

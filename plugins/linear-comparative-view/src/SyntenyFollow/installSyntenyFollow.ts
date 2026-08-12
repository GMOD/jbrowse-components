import { assembleLocStringRaw, getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { followAnchorWindow } from './followAnchorWindow.ts'
import { followDirection } from './followDirection.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'
import { pickFollowFeature } from './pickFollowFeature.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface FollowLevel {
  level: number
  linearSyntenyDisplays: LinearSyntenyDisplayModel[]
}

export interface SyntenyFollowHost extends IStateTreeNode {
  followSynteny: boolean
  followAnchorIndex: number
  views: LinearGenomeViewModel[]
  levels: FollowLevel[]
  setFollowUnaligned: (arg: boolean) => void
}

// One level's resolved intent for this pass, everything observable already read.
interface FollowStep {
  level: number
  display: LinearSyntenyDisplayModel
  movingView: LinearGenomeViewModel
  feat: FeatPos
  window: FollowWindow
  // where the moving row is sitting right now, so the "is it already there"
  // test needs nothing observable once this pass is over. See alreadyShowing.
  movingWindow: FollowWindow | undefined
  toMate: boolean
  // whether the alignment carries a CIGAR to walk, decided from the same fetch
  // the feature came out of
  hasCigar: boolean
}

/**
 * Per-level state the follow keeps between passes.
 *
 * PLAIN JS, DELIBERATELY NOT OBSERVABLE AND NOT ON THE MODEL. The autorun writes
 * this on every pass; an observable would make it a dependency of the very run
 * that writes it, and the follow would re-enter itself forever. It is also not
 * state a session should persist — `featureId` is only comparable within one
 * fetch of one LOD tier.
 */
interface LevelState {
  // the alignment this level followed last, for pickFollowFeature's hysteresis
  featureId?: string
  // latest-wins guard. A pan issues one resolve per settled position and the RPC
  // is not ordered, so a slow earlier one can land after a fast later one and
  // park the panel at a window the user has already left.
  seq: number
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
 * Keep the non-anchor genome rows on the region that aligns to the anchor row,
 * re-resolved whenever the anchor settles.
 *
 * This is the continuous form of the band context menu's "Move bottom panel to
 * the matching region", and it resolves the same way: the anchor's visible
 * WINDOW mapped through one alignment, as a span rather than a midpoint, so the
 * moved panel matches the anchor's scale and the ribbons between them stay
 * near-vertical. What differs is that nobody clicks a band — the alignment is
 * picked by overlap with the anchor window (`pickFollowFeature`), and a
 * CIGAR-less block is interpolated across rather than refused
 * (`interpolateFollowSpan` says why those two answer it differently).
 *
 * FOLLOWS THE DEBOUNCED WINDOW (`coarseDynamicBlocks`, ~500ms behind the
 * pointer) rather than the live one. The click path reads `dynamicBlocks`
 * because it answers a click that already happened; this one answers a drag in
 * progress, and resolving per pointer-move would issue an RPC per frame to park
 * a panel the user is still moving away from. Settling first is also what makes
 * the moved panel read as a consequence of the pan rather than a competitor to
 * it.
 *
 * READS WHAT IS DRAWN, NOT WHAT IS CURRENT. The features scanned are the ones
 * the display holds, which after a large jump can briefly be the previous
 * window's — the same ones still painted on screen. Following those is honest
 * (the answer matches the picture), the fetch window carries a pan buffer so the
 * common case is not stale at all, and the autorun re-runs when the fetch lands
 * and corrects itself.
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

  async function execute(step: FollowStep) {
    const {
      level,
      display,
      movingView,
      movingWindow,
      feat,
      window,
      toMate,
      hasCigar,
    } = step
    const state = stateFor(level)
    const seq = ++state.seq
    // The CIGAR walk first where there is one to walk, interpolation where there
    // is not. `hasCigar` is per-FETCH, not per-feature — true when any block in
    // the response carried one — so a file that mixes them (a chain set with a
    // few CIGAR-less rows, a PAF concatenated from two runs) reaches the walk
    // and gets nothing back. Falling through rather than giving up keeps those
    // blocks followable, on the same terms as a wholly CIGAR-less tier.
    const span =
      (hasCigar
        ? await resolveMatchingSpan({ model: display, feat, window, toMate })
        : undefined) ?? interpolateFollowSpan({ feat, window, toMate })
    // superseded while the resolve was in flight, or the view went away
    if (seq !== state.seq || !isAlive(self) || !isAlive(movingView)) {
      return
    }
    state.featureId = feat.id
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

  addDisposer(
    self,
    autorun(
      function syntenyFollowAutorun() {
        if (!self.followSynteny) {
          return
        }
        // Every observable read happens in this synchronous pass, so the
        // dependency set is complete before anything awaits. `execute` below is
        // async and its reads would not be tracked.
        const steps: FollowStep[] = []
        // Levels that HAVE alignments loaded and still found none over the
        // anchor window — the state the header reports, see setFollowUnaligned.
        // Loading is deliberately not counted: a level whose fetch has not
        // landed has no answer yet rather than no answer, and flagging it would
        // blink a warning on every pan.
        let unaligned = false
        for (const { level, linearSyntenyDisplays } of self.levels) {
          const { stayingIndex, movingIndex, toMate } = followDirection(
            level,
            self.followAnchorIndex,
          )
          const stayingView = self.views[stayingIndex]
          const movingView = self.views[movingIndex]
          if (!stayingView?.initialized || !movingView?.initialized) {
            continue
          }
          const window = followAnchorWindow(stayingView.coarseDynamicBlocks)
          if (!window) {
            continue
          }
          // The moving row's own settled window, read here so this pass owns
          // every observable the follow depends on. It makes that row a
          // DEPENDENCY, which is deliberate and is what re-asserts the follow
          // over a row the user nudged by hand. The debounced blocks, not the
          // live ones, for the same reason the anchor uses them: tracking the
          // live position would wake the follow on every frame of a drag and
          // fight the user for the row. It converges — the nav below settles,
          // wakes this once more, and `alreadyShowing` then says there is
          // nothing to do.
          const movingWindow = followAnchorWindow(
            movingView.coarseDynamicBlocks,
          )
          // The level's LOWER row, which is the one on the alignments' mate
          // axis whichever direction this level runs in — so it names the lane
          // of an all-vs-all track that this level is about.
          const mateAssembly = self.views[level + 1]?.assemblyNames[0]
          // A level can carry more than one synteny track. Each is asked for its
          // best alignment over the window and the widest wins, so a sparse
          // track does not outvote the one that actually covers the locus.
          let best: FollowStep | undefined
          let bestOverlap = 0
          for (const display of linearSyntenyDisplays) {
            const data = display.featureData
            if (!data) {
              continue
            }
            const candidate = pickFollowFeature({
              data,
              window,
              toMate,
              mateAssembly,
              incumbentId: stateFor(level).featureId,
            })
            if (candidate && (!best || candidate.overlap > bestOverlap)) {
              bestOverlap = candidate.overlap
              best = {
                level,
                display,
                movingView,
                movingWindow,
                feat: getFeatureAtIndex(data, candidate.index),
                window,
                toMate,
                hasCigar: data.hasCigar,
              }
            }
          }
          // No alignment over the anchor window — a haplotype-specific
          // insertion, a centromere, a panel parked off the end of the file.
          // The moving panel HOLDS POSITION rather than being sent somewhere
          // invented, and picks the follow back up when the anchor pans into
          // aligned sequence again. Reported rather than only silent: a row
          // that stops tracking with nothing said is the same picture as a
          // broken follow.
          if (best) {
            steps.push(best)
          } else if (linearSyntenyDisplays.some(d => d.featureData)) {
            unaligned = true
          }
        }
        // Written, never read here — reading it would make the autorun a
        // dependency of its own write. The header is the only consumer.
        self.setFollowUnaligned(unaligned)
        // `execute` reads no observables — everything it needs is in the step —
        // so it does not matter that an async function runs synchronously up to
        // its first await, and the CIGAR-less path (which awaits nothing before
        // navigating) needs no special handling.
        for (const step of steps) {
          execute(step).catch((e: unknown) => {
            // ONCE PER DISTINCT MESSAGE. A follow that cannot resolve usually
            // cannot resolve repeatedly — an assembly whose refName the moving
            // row does not have keeps failing the same way on every pan — and a
            // snackbar per settle would bury the app in identical notifications
            // for a background action nobody asked to run.
            const message = `${e}`
            if (message !== lastErrorMessage) {
              lastErrorMessage = message
              getSession(self).notifyError(message, e)
            }
          })
        }
      },
      { name: 'SyntenyFollow' },
    ),
  )
}

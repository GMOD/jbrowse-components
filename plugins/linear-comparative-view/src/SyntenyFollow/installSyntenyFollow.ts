import { getNotificationSink } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { rowLabels } from '../LinearComparativeView/rowLabel.ts'
import { navToResolvedSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { alreadyShowing } from './alreadyShowing.ts'
import {
  followAnchorWindow,
  followAnchorWindows,
  followPlacedWindows,
} from './followAnchorWindow.ts'
import { logFollowSpread, logFollowStep } from './followDebug.ts'
import { followFrameSpan } from './followFrameSpan.ts'
import {
  followWindowSignature,
  handNudged,
  handNudgeMessage,
} from './followHandNudge.ts'
import { createFollowLevelStates } from './followLevelStates.ts'
import { followSpreadSpans } from './followSpreadSpans.ts'
import { followTransform } from './followTransform.ts'
import { planFollowStep } from './planFollowStep.ts'
import {
  positionViewOnSpan,
  positionViewOnSpans,
} from './positionViewOnSpan.ts'
import { requestCigarMap } from './requestCigarMap.ts'
import { decideSpread } from './spreadDecision.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowLevelState } from './followLevelStates.ts'
import type { FollowStep } from './planFollowStep.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  LinearGenomeViewModel,
  RegionsOrientation,
} from '@jbrowse/plugin-linear-genome-view'

export interface FollowLevel {
  linearSyntenyDisplays: LinearSyntenyDisplayModel[]
}

export interface FollowPair {
  level: FollowLevel
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  toMate: boolean
  mateAssembly?: string
  // which row of the stack the moving view is, for the one message that has to
  // NAME it — `rowLabels` disambiguates by position, and the views themselves
  // do not know where they sit
  movingIndex: number
}

/**
 * A level that refused its multi-contig answer, in the two names the header
 * needs: the anchor region the rows are following, and the ones whose answers
 * are not on screen.
 *
 * Named regions rather than a bare flag because that is the whole difference
 * between a silent loss and a reachable one — the reader gets to the other
 * answer by scrolling the anchor onto the region that carries it, which is an
 * ordinary navigation of the row they are already driving, needing no button
 * and no undo. What they cannot do is guess that the region is there.
 */
export interface FollowPartialReport {
  following: string
  elsewhere: string[]
}

export interface SyntenyFollowHost extends IStateTreeNode {
  followSynteny: boolean
  followMatchOrientation: boolean
  followPairs: FollowPair[]
  setFollowUnaligned: (arg: boolean) => void
  setFollowApproximate: (arg: boolean) => void
  setFollowPartial: (arg: FollowPartialReport | undefined) => void
  // The four below are the hand-nudge message and nothing else: it names both
  // rows, and the two ways out of the snap it reports are the same two settings
  // the header menu offers. Read and called only from `reportHandNudge`, which
  // runs at most once per level per follow-on.
  followAnchorIndex: number
  views: { assemblyNames: string[] }[]
  setFollowAnchorIndex: (idx: number) => void
  setRowSyncMode: (mode: 'independent' | 'link' | 'follow') => void
}

// One level's placement, with the observables the async half needs already read
// off the tree. `movingWindow` is `alreadyShowing`'s operand — where the row
// ACTUALLY is, which the exact pass reads on purpose.
//
// The two fields off the `FollowPair` rather than the pair itself, so that this
// says what the async half can still reach: `step` already carries the window,
// the display and `toMate`, and the staying row is the one thing a settled
// answer must never re-read.
interface FollowWork {
  level: FollowLevel
  movingView: LinearGenomeViewModel
  step: FollowStep
  movingWindow: FollowWindow | undefined
  // the narrowest window the moving row can show, which is what lets
  // `alreadyShowing` terminate over an answer below it
  movingMinWidthBp: number
  // Read HERE, tracked, so the checkbox wakes this pass: `orient` runs past the
  // autorun's first `await` and inside its `untracked`, so a flag it read for
  // itself would take effect only on whatever moved the anchor next.
  matchOrientation: boolean
  // the anchor's orientation as it stands, so the flip decision is relative: a
  // reversed anchor inside a forward block wants a reversed mate
  anchorOrientation: RegionsOrientation
  // the row moved and nothing in this level moved it, so a placement over the
  // top of it is the follow overriding the user rather than following the
  // anchor — read only when this rung actually navigates
  handNudged: boolean
  // only ever the hand-nudge message's, which names the row
  movingIndex: number
  seq: number
  generation: number
}

/**
 * What this pass has decided each row it moves should be showing, for the level
 * beyond it to read INSTEAD OF that row's own blocks.
 *
 * A row placed across several contigs also shows every contig between them —
 * `positionViewOnSpans` places an interval of one layout, and a row lays its
 * regions end to end — so read back off the blocks, filler the follow was
 * forced to include is indistinguishable from a contig that mapped. The next
 * level then maps it, its answer widens to reach wherever that filler points,
 * and the level after that inherits the wider set: three rows was enough to
 * leave the far one on the whole genome from a two-contig answer.
 * `followPlacedWindows` is the shape of what goes in here.
 *
 * Keyed by the view rather than the level, since it is written for a level's
 * moving row and read for the next level's staying row, which are the same row
 * under a different name. `followPairs` is ordered outward from the anchor, so
 * the entry is always written before the level that reads it.
 */
type PlacedWindows = Map<LinearGenomeViewModel, FollowWindow[]>

// One level's placement when the anchor is showing SEVERAL contigs. No RPC and
// no block: the answer is the union of what those contigs map to, and the row
// is placed across the interval of its own layout that covers it.
interface SpreadWork {
  level: FollowLevel
  movingView: LinearGenomeViewModel
  spans: ResolvedSpan[]
  // as in `FollowWork`, and read on every placement rather than on a navigation
  // — this rung re-places its row every pass, so there is no narrower moment
  handNudged: boolean
  movingIndex: number
}

// One level's share of a settled pass: what to resolve, and what the header
// should say if there is nothing to.
interface FollowPlan {
  // absent when nothing loaded covers the anchor's window
  work?: FollowWork
  // the rung above `work`, and never set alongside it
  spread?: SpreadWork
  unaligned: boolean
  approximate: boolean
  // set when the multi-contig rung had an answer and refused it as mostly
  // filler, naming the region the rows follow and the ones they do not
  partial?: FollowPartialReport
}

// Where a row is, off the LIVE blocks, for telling a placement that moved it
// from one that wrote the numbers already there. Never compared across passes —
// `followAnchorWindow`'s debounced read is what a pass sees, and the two differ
// by exactly the settle this is called inside of.
function placedWindowSignature(view: LinearGenomeViewModel) {
  return followWindowSignature(
    followAnchorWindows(view.dynamicBlocks.contentBlocks),
  )
}

// One navigation, as "from where" and "to where". Both halves matter: the same
// target from a different place is the follow re-asserting itself over a row the
// user has since dragged, which has to stay allowed.
function navSignature(from: FollowWindow | undefined, to: ResolvedSpan) {
  const here = from
    ? `${from.refName}:${from.start}-${from.end}`
    : 'nowhere-yet'
  return `${here}>${to.refName}:${to.start}-${to.end}`
}

/**
 * Keep the non-anchor genome rows on the region that aligns to the anchor row —
 * the continuous form of the band menu's "Move bottom panel to the matching
 * region", mapping the anchor's visible WINDOW rather than a midpoint so the
 * moved row matches its scale.
 *
 * Two passes: an exact one on the debounced window, because it costs an RPC,
 * and a per-frame one that fills in the motion between those. Without the
 * second the row does not lag, it sits still through a drag and jumps once half
 * a second later.
 */
export function installSyntenyFollow(self: SyntenyFollowHost) {
  const levelStates = createFollowLevelStates<FollowLevel>()

  async function execute({
    level,
    movingView,
    step,
    movingWindow,
    movingMinWidthBp,
    matchOrientation,
    anchorOrientation,
    handNudged,
    movingIndex,
    seq,
    generation,
  }: FollowWork) {
    const state = levelStates.get(level)
    const { span, approximate } = await state.answer(step)
    // Switching the mode off bumps no seq, so it needs its own check — and
    // switching it back on again defeats that one, since `state` is then the
    // object the drop orphaned rather than the one the new pass minted. Its
    // `seq` is whatever this work left it at, so latest-wins says yes and the
    // row lands on a window two navigations ago.
    if (
      seq !== state.seq ||
      generation !== levelStates.generation ||
      !isAlive(self) ||
      !isAlive(movingView) ||
      !self.followSynteny
    ) {
      return
    }
    // A WALK THAT COLLAPSES TO A POINT IS NOT A PLACE. `resolveAlignmentSpan`
    // clamps the window to the block before walking it, so a block whose axes
    // do not mean what the plan thought — a swapped-assembly track, which is a
    // config someone can legitimately write — brings both ends back on the same
    // coordinate. Navigating there flings the row to base-level zoom on a
    // coordinate the arithmetic never identified, so the row holds instead, and
    // says so.
    if (span.end - span.start <= 0) {
      // and the frame pass has to hold too, which means dropping the pick
      // rather than leaving the last good one standing. It steers by whatever
      // the last settle chose, so a row this branch has decided to hold went on
      // being placed through a block this pass just disowned — on a transform
      // measured over a window it had already left, which nothing later
      // corrects while the answers keep collapsing.
      state.pick = undefined
      self.setFollowUnaligned(true)
      return
    }
    state.lastErrorMessage = undefined
    // The plan already raised this for the two cases it can see. The third is
    // only visible here: `hasCigar` is per-FETCH, so a mixed file reaches the
    // walk with a block that carries none and comes back empty. Raised, never
    // lowered — the plan's own pass owns the reset.
    if (approximate) {
      self.setFollowApproximate(true)
    }
    state.pick = {
      feat: step.feat,
      display: step.display,
      toMate: step.toMate,
      target: span.refName,
      transform: step.windowInsideFeat
        ? followTransform(step.window, span, step.feat.strand === -1)
        : undefined,
    }
    ensureCigarMap(state, step)
    if (alreadyShowing(movingWindow, span, movingMinWidthBp)) {
      // arrived, so the next disagreement is a fresh one — a row the user
      // nudges away from here has to be navigable back to exactly this span
      state.lastNav = undefined
    } else {
      // THE BACKSTOP, and it bounds the loop without claiming to diagnose it.
      // Nothing else damps this: `navToLocString` replaces the row's
      // `displayedRegions` whether or not it moves the row, which invalidates
      // `followPairs` and wakes this pass. Measured on the swapped track —
      // coarse blocks, featureData and width all stable across fourteen
      // consecutive passes — so an `alreadyShowing` that says no while the row
      // has stopped moving is a locked tab, not a misplacement. The two checks
      // above close the two ways that is reachable today; this closes the shape
      // of it.
      //
      // The same target asked for from the same place twice is the one thing
      // that cannot be a real disagreement: the first attempt already had its
      // chance, and the row is still reporting where it was.
      const nav = navSignature(movingWindow, span)
      if (nav !== state.lastNav) {
        state.lastNav = nav
        state.movedRow = true
        reportHandNudge(state, movingIndex, handNudged)
        await navToResolvedSpan(movingView, span)
        if (
          seq !== state.seq ||
          generation !== levelStates.generation ||
          !isAlive(self) ||
          !isAlive(movingView)
        ) {
          return
        }
      }
    }
    // AFTER THE NAVIGATION, which can undo it. `navToResolvedSpan` falls back
    // to `navToLocString` for a span on a contig the row is not displaying, and
    // a bare locstring names no orientation — so the row it replaces
    // `displayedRegions` with is forward whatever the row was. Flipped first,
    // that landed the row the wrong way round with the decision already
    // recorded against it, and nothing re-asserted until the anchor left the
    // block.
    orient(state, step, matchOrientation, anchorOrientation, movingView)
  }

  /**
   * Place a row from a multi-contig anchor window: one `moveTo` across whatever
   * interval of its layout the union covers.
   *
   * NOT ASYNC and NOT A NAVIGATION in the ordinary case. `positionViewOnSpans`
   * leaves the row's displayed regions alone, which is what lets a row showing
   * a whole genome go on showing one — a locstring cannot name two contigs, and
   * `navToLocString` would collapse the row onto whichever one it did name.
   *
   * DROPPING THE PICK IS PART OF THE PLACEMENT. No one block places the row
   * here, and the frame pass steers by whatever the last settle chose — leaving
   * a pick standing kept placing the row through a single alignment this rung
   * has just decided does not describe the window.
   */
  function executeSpread({
    level,
    movingView,
    spans,
    movingIndex,
    handNudged,
  }: SpreadWork) {
    const state = levelStates.get(level)
    state.pick = undefined
    reportHandNudge(state, movingIndex, handNudged)
    // MEASURED RATHER THAN ASSUMED, unlike the navigating rung below, because
    // this one re-places its row every pass and most of those passes write the
    // numbers already there. A flag raised on the placement itself therefore
    // never came down — the last pass of a settle left it standing, and the
    // nudge after it read as the follow's own work.
    //
    // The live blocks on both sides: this compares a placement against itself,
    // where `lastWindows` compares one pass against the next.
    const before = placedWindowSignature(movingView)
    const placed = positionViewOnSpans(movingView, spans)
    state.movedRow = placedWindowSignature(movingView) !== before
    if (placed) {
      state.lastNav = undefined
      return
    }
    // The row displays none of what it should be showing, which only a
    // navigation reaches. The widest span, since a row that can hold one contig
    // is being sent to a contig — and once it lands, the pass after this one
    // places it properly.
    const widest = spans.reduce((a, b) =>
      b.end - b.start > a.end - a.start ? b : a,
    )
    const nav = `spread>${widest.refName}:${widest.start}-${widest.end}`
    if (nav !== state.lastNav) {
      state.lastNav = nav
      navToResolvedSpan(movingView, widest).catch((e: unknown) => {
        reportError(level, e)
      })
    }
  }

  /**
   * Turn the moving row round when the alignment placing it runs the other
   * way, so panning the anchor right moves the row right and the ribbons run
   * parallel instead of crossing.
   *
   * ONCE PER DECISION, not once per settle. The key is whatever placed the row
   * — the block, or the contig the envelope answered on — plus the anchor's own
   * orientation; a row the user flips by hand afterwards disagrees with the
   * key's answer and is left alone until the decision changes, which is what
   * spares the row's Flip item an anchor take. A mixed window decides nothing
   * (`wantReversed` undefined) and leaves the row as it was.
   *
   * THE ROW'S OWN ORIENTATION, not its leftmost block's. `horizontallyFlip`
   * reverses every region at once, so the only orientation it can answer is the
   * row-wide one — and a row someone reversed a single region of by hand has
   * none, which is `mixed`. Read off the blocks instead, such a row reported
   * whichever region the window happened to be over and the follow turned every
   * OTHER region round to agree with it.
   *
   * `horizontallyFlip` keeps the bp window and replaces `displayedRegions`,
   * which wakes this pass; the replan carries the same key and does not flip
   * again.
   */
  function orient(
    state: FollowLevelState,
    step: FollowStep,
    matchOrientation: boolean,
    anchorOrientation: RegionsOrientation,
    movingView: LinearGenomeViewModel,
  ) {
    if (!matchOrientation) {
      // DROPPED WHILE OFF, so that switching back on re-asserts. The decision
      // is the checkbox's as much as the anchor's: kept, a row turned round by
      // hand while the mode was off sat wrong-way-up under a mode that was on,
      // until the anchor happened to leave the block.
      state.orientedKey = undefined
      return
    }
    if (step.wantReversed === undefined) {
      return
    }
    // the same fallback the placement takes: with no envelope the row is placed
    // by interpolating across the picked block (`resolveFollowSpan`), so that
    // block is the decision
    const decision = step.windowInsideFeat
      ? step.feat.id
      : (step.envelope?.refName ?? step.feat.id)
    const key = `${decision}|${step.wantReversed}|${anchorOrientation}`
    if (key === state.orientedKey) {
      return
    }
    const movingOrientation = movingView.displayedRegionsOrientation
    // Not recorded, so a row that stops being mixed is decided then
    if (anchorOrientation === 'mixed' || movingOrientation === 'mixed') {
      return
    }
    state.orientedKey = key
    const anchorReversed = anchorOrientation === 'reversed'
    const movingReversed = movingOrientation === 'reversed'
    if (movingReversed !== (anchorReversed !== step.wantReversed)) {
      movingView.horizontallyFlip()
    }
  }

  /**
   * Fetch this block's CIGAR map, once, if the frame pass could use one.
   *
   * NOT AWAITED, and its failure is not this pass's failure: the row is already
   * being placed by the transform, and a map that never arrives costs precision
   * between settles rather than a placement. So it neither blocks the resolve
   * that just landed nor reaches `reportError`, which is for a follow that
   * cannot resolve at all.
   *
   * `mapPending` rather than a promise, since the only question a second settle
   * inside the same block asks is whether to ask again.
   *
   * ON AN ENVELOPE SETTLE TOO. The envelope itself reads no map, but the pick
   * is the widest block under the window, and a zoom into it mid-drag is placed
   * by the affine transform until the next settle unless the map is already
   * here — the frame pass reads `mapFor(pick.feat.id)` the moment the window is
   * inside the block, and the map is a property of the block, not the window.
   */
  function ensureCigarMap(state: FollowLevelState, step: FollowStep) {
    const featureId = step.feat.id
    if (
      !step.hasCigar ||
      state.map?.featureId === featureId ||
      state.mapPending === featureId
    ) {
      return
    }
    state.mapPending = featureId
    const generation = levelStates.generation
    requestCigarMap({
      model: step.display,
      feat: step.feat,
      stopToken: levelStates.stopToken,
    })
      .then(value => {
        // The map is a property of the BLOCK, so `seq` is the wrong guard —
        // a later window inside the same block still wants this. What makes it
        // stale is the store being dropped underneath it.
        if (generation === levelStates.generation) {
          state.map = { featureId, value }
        }
      })
      .catch(() => {
        // asked again next settle: the frame pass is only less precise without
        // it, and a level whose resolves work has nothing to report here
      })
      .finally(() => {
        if (state.mapPending === featureId) {
          state.mapPending = undefined
        }
      })
  }

  /**
   * Say that the follow just put a row back, once per level per follow-on.
   *
   * THE ONE MOMENT THE MODE OWES AN EXPLANATION. Zooming a followed row out and
   * having it come straight back is the same picture as a broken control, and
   * nothing else on screen distinguishes them: the header toggle is a 31px icon
   * whose tooltip has to be hovered for, and which row drives is otherwise
   * visible only inside a submenu. `followUnaligned` and `followApproximate`
   * are reported for the same reason and cannot cover this one — a row that is
   * holding and a row that is being moved back look nothing alike to the code
   * and identical to the reader.
   *
   * BOTH ACTIONS KEEP THE MOVE the reader was trying to make, which is why
   * there are two rather than an explanation alone: anchoring this row is the
   * one for someone who wants to drive from here and keep the other rows with
   * them, stopping is the one for someone who wants this row alone. Neither is
   * taken for them — an anchor that moves itself under a hand zoom is the
   * silent version of the same surprise.
   *
   * ONCE, because the second telling is a message they have already read, and
   * an actionable snackbar does not dedup on its own (`pushSnackbarMessage`
   * dedups only the action-less ones). It persists until dismissed, which is
   * what the reading and the click both need.
   */
  function reportHandNudge(
    state: FollowLevelState,
    movingIndex: number,
    nudged: boolean,
  ) {
    if (nudged && !state.nudgeReported && isAlive(self)) {
      const labels = rowLabels(self.views)
      const moving = labels[movingIndex]
      const anchor = labels[self.followAnchorIndex]
      if (moving !== undefined && anchor !== undefined) {
        state.nudgeReported = true
        getNotificationSink(self).notify(
          handNudgeMessage(moving, anchor),
          'info',
          [
            {
              name: `Anchor ${moving} instead`,
              onClick: () => {
                self.setFollowAnchorIndex(movingIndex)
              },
            },
            {
              name: 'Stop following',
              onClick: () => {
                self.setRowSyncMode('independent')
              },
            },
          ],
        )
      }
    }
  }

  function reportError(level: FollowLevel, e: unknown) {
    // an RPC outliving its view rejects into here, and getSession throws on a
    // node with no parent
    if (!isAlive(self)) {
      return
    }
    // A follow that cannot resolve cannot resolve repeatedly, and a snackbar
    // per settle would bury the app — `notifyError` always carries a `report`
    // action, which is what makes it bypass the snackbar's own dedup.
    const state = levelStates.get(level)
    const message = `${e}`
    if (message !== state.lastErrorMessage) {
      state.lastErrorMessage = message
      getNotificationSink(self).notifyError(message, e)
    }
  }

  /**
   * The multi-contig rung: its answer, and whether that answer is worth the
   * screen it costs.
   *
   * Returns the plan when the row spreads, and the window to fall through to the
   * rung below with when it does not. `decideSpread` carries the reasoning; what
   * lives here is the two things only this pass knows — that a CARRIED spread is
   * not re-judged, since it came from a level that already judged it and its
   * windows are spans, partial by construction, so an honest whole-genome
   * overview would demote its second row and every row after it — and that the
   * decision has to run UPSTREAM OF THE CARRY, or `placed` hands the next level
   * the union this one just refused.
   */
  function planSpread({
    pair,
    windows,
    carried,
    nudged,
    state,
    placed,
  }: {
    pair: FollowPair
    windows: FollowWindow[]
    carried: boolean
    nudged: boolean
    state: FollowLevelState
    placed: PlacedWindows
  }) {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const { spans, mapped } = followSpreadSpans({
      displays: level.linearSyntenyDisplays,
      windows,
      toMate,
      mateAssembly,
    })
    const decision =
      carried || !spans.length
        ? { spreading: true }
        : decideSpread({
            blocks: stayingView.coarseDynamicBlocks,
            stayingRegions: stayingView.displayedRegions,
            // untracked: the tracked read of this row is its blocks, above,
            // and its region set changes only by a navigation the follow
            // may not make here
            // eslint-disable-next-line no-restricted-syntax -- self-write: the placement this pass is about to make
            movingRegions: untracked(() => movingView.displayedRegions),
            windows,
            spans,
            mapped,
            previous: state.spread,
          })
    state.spread = decision
    logFollowSpread({
      stayingView,
      movingView,
      windows,
      carried,
      spans,
      decision,
    })
    if (!decision.spreading) {
      return {
        window: windows.find(w => w.refName === decision.onto),
      }
    }
    if (spans.length) {
      placed.set(movingView, followPlacedWindows(spans))
    }
    return {
      plan: {
        spread: spans.length
          ? {
              level,
              movingView,
              spans,
              movingIndex: pair.movingIndex,
              handNudged: nudged,
            }
          : undefined,
        unaligned:
          !spans.length && level.linearSyntenyDisplays.some(d => d.featureData),
        // an interpolation over several alignments at once, never a walk
        approximate: spans.length > 0,
      } satisfies FollowPlan,
    }
  }

  // Every observable one level's placement needs, read off the tree HERE:
  // `execute` is async and MobX stops tracking at its first `await`, so a field
  // missing from `FollowStep` can only be read untracked, producing a follow
  // that works once and never re-fires.
  function planLevel(pair: FollowPair, placed: PlacedWindows): FollowPlan {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const state = levelStates.get(level)
    // UNCONDITIONALLY, so the checkbox is a dependency of the pass whichever
    // rung the level ends up on — read where it is used, at the bottom, a level
    // placed by the multi-contig rung registers none and the toggle waits for
    // whatever moves the anchor next.
    const matchOrientation = self.followMatchOrientation
    // EVERY LEVEL THE PASS VISITS, not only the ones it goes on to resolve. A
    // pass that finds nothing under the window has decided the row holds, and
    // an answer still in flight for the previous window landed and moved it
    // anyway — while the header reported it as holding, which is the one thing
    // that state promises.
    const seq = ++state.seq
    // WHAT THIS PASS PLACED THE ROW ON, where it placed it, rather than what the
    // row is showing — the two differ by the filler between two mapped contigs,
    // and reading that back is what compounds a spread up a stack. Not reading
    // the blocks also drops the dependency on a row this pass writes; what
    // re-asserts a hand-nudged interior row is the level's own fetch key, which
    // names both rows, exactly as it is for the multi-contig rung's moving row.
    const carried = placed.get(stayingView)
    const windows =
      carried ?? followAnchorWindows(stayingView.coarseDynamicBlocks)
    const widest = windows[0]
    // A DECISION ABOUT SEVERAL CONTIGS SAYS NOTHING ABOUT ONE, and
    // `state.spread` is only ever written by the rung that makes it. The rung is
    // out of reach below two windows, so `planSpread` does not run and a refusal
    // left standing outlives the window set it was made over: the header went on
    // naming a region the anchor no longer spans, ahead of `approximate` in the
    // wording, and told the reader to scroll onto a contig they were already on
    // — while the row was in fact following it, by the `widest` fallback — and
    // the frame pass inherited the incumbent and the hysteresis band when the
    // anchor widened again. All answers to a question this pass is no longer
    // asking.
    if (windows.length <= 1) {
      state.spread = undefined
    }
    if (!widest) {
      // an anchor with no window says nothing about alignment either way
      return { unaligned: false, approximate: false }
    }

    // READ BEFORE ANY RUNG, which makes the moving row a dependency of every
    // one of them: that is what re-asserts the follow over a row nudged by
    // hand. The multi-contig rung used to skip it and waited on the level's
    // refetch instead, ~1s on `volvox_contig_swap`; a placement that writes the
    // same numbers settles the same block keys, so the re-entry converges.
    const movingBlocks = movingView.coarseDynamicBlocks
    const movingWindow = followAnchorWindow(movingBlocks)
    // WHO MOVED THE ROW, decided here because only a pass that reads both rows
    // can tell — past `execute`'s first await the answer is a placement with no
    // provenance. The snapshot is written every pass whichever rung runs, so a
    // level that changes rung does not carry a comparison made under the other
    // one, and `movedRow` is cleared in the same breath it is read: it is a
    // fact about the pass just gone.
    // EVERY window of the moving row, where `alreadyShowing` wants the widest
    // one: zooming a whole-genome row down onto its widest contig leaves that
    // contig's window exactly as it was, so by the widest alone the loudest
    // nudge the mode has is the one it cannot see.
    const nowWindows = {
      input: followWindowSignature(windows),
      moving: followWindowSignature(followAnchorWindows(movingBlocks)),
    }
    const nudged = handNudged({
      now: nowWindows,
      previous: state.lastWindows,
      placedByFollow: !!state.movedRow || state.lastNav !== undefined,
    })
    state.lastWindows = nowWindows
    state.movedRow = false

    // THE THIRD RUNG. Inside one alignment the answer is a CIGAR walk, wider
    // than one it is the envelope of what lies under the window — and wider
    // than one CONTIG there is no single matching region at all, so the answer
    // is the union across the contigs on screen. Without it a whole-genome
    // overview placed every other row on whichever single contig aligned to the
    // anchor's widest, which is what "show all regions" then only did to the
    // anchor row.
    const spread =
      windows.length > 1
        ? planSpread({
            pair,
            windows,
            carried: !!carried,
            nudged,
            state,
            placed,
          })
        : undefined
    if (spread?.plan) {
      return spread.plan
    }
    // DEMOTED: the rung above had an answer and refused it, so this level is
    // placed by the rung below from the one window the reader is mostly looking
    // at. Everything past here is that rung, unchanged — which is the point of
    // demoting rather than trimming the union: the block pick, the CIGAR map,
    // the settled resolve and `alreadyShowing` all already work.
    const window = spread?.window ?? widest
    const step = planFollowStep({
      displays: level.linearSyntenyDisplays,
      window,
      toMate,
      mateAssembly,
      incumbentId: state.pick?.feat.id,
      incumbentTarget: state.pick?.target,
    })
    logFollowStep({
      stayingView,
      movingView,
      window,
      carried: !!carried,
      rung: step
        ? step.windowInsideFeat
          ? 'RUNG1 walk'
          : 'RUNG2 envelope'
        : 'HOLD',
      target: state.pick?.target,
    })
    return {
      work: step && {
        level,
        movingView,
        step,
        movingWindow,
        movingMinWidthBp: movingView.minBpPerPx * movingView.width,
        matchOrientation,
        anchorOrientation: stayingView.displayedRegionsOrientation,
        handNudged: nudged,
        movingIndex: pair.movingIndex,
        seq,
        generation: levelStates.generation,
      },
      // a level still fetching has no answer YET rather than no answer
      unaligned: !step && level.linearSyntenyDisplays.some(d => d.featureData),
      approximate: !!step && (!step.windowInsideFeat || !step.hasCigar),
      partial:
        state.spread?.spreading === false && state.spread.onto
          ? {
              following: state.spread.onto,
              elsewhere: state.spread.elsewhere ?? [],
            }
          : undefined,
    }
  }

  // The store's own teardown. `clear()` already runs on follow-off, inside the
  // autorun below — this is the other way a follow ends, and without it a map
  // in flight when the view closes went on reading the file for a store nobody
  // would look at again.
  addDisposer(self, () => {
    levelStates.clear()
  })
  addDisposer(
    self,
    autorun(
      function syntenyFollowAutorun() {
        if (!self.followSynteny) {
          self.setFollowUnaligned(false)
          self.setFollowApproximate(false)
          self.setFollowPartial(undefined)
          levelStates.clear()
          return
        }
        const placed: PlacedWindows = new Map()
        const plans = self.followPairs.map(pair => planLevel(pair, placed))
        // written, never read here: reading either would make the autorun a
        // dependency of its own write
        self.setFollowUnaligned(plans.some(p => p.unaligned))
        self.setFollowApproximate(plans.some(p => p.approximate))
        // the first level that refused, since one sentence is what the header
        // has and a second one would say the same thing about another pair
        self.setFollowPartial(plans.find(p => p.partial)?.partial)
        // UNTRACKED, because `execute` runs synchronously up to its first
        // `await` and so still inside this reaction. `FollowStep` is meant to
        // be everything it needs, but the resolve reaches the display for
        // `adapterConfig` and `lodTier` — and `lodTier` is derived from both
        // connected views' RAW bpPerPx, which the frame pass writes every
        // frame. That made one settled resolve register the moving row's zoom
        // as a dependency of the debounced pass, costing an extra full plan
        // (the envelope scan included) per settle.
        // eslint-disable-next-line no-restricted-syntax -- effect input: execute consumes the display's adapterConfig and lodTier, the plans are the decision
        untracked(() => {
          for (const { work, spread } of plans) {
            if (spread) {
              executeSpread(spread)
            }
            if (work) {
              execute(work).catch((e: unknown) => {
                reportError(work.level, e)
              })
            }
          }
        })
      },
      { name: 'SyntenyFollow' },
    ),
  )

  // Replans against the live window rather than extrapolating the last exact
  // answer, which tracked a drag perfectly and then snapped 43% of a screen on
  // settle: past one alignment the answer is the envelope, and an envelope is
  // not an affine function of the window.
  //
  // Reads each level's staying row, never its moving row, which this pass
  // writes — and `followPairs` is ordered outward from the anchor so that an
  // interior row, which is both, is written before the level beyond it reads it.
  //
  // TRACKED ONLY WHERE IT IS AN INPUT. The ordering gets the interior row the
  // right VALUE, but reading it still registers a dependency on a row this same
  // run just wrote, so MobX re-ran the whole pass once per pan — measured at
  // exactly 2.00 runs per step on a three-row stack anchored at the top against
  // 1.00 for two rows and 1.00 for three anchored in the middle, which is the
  // interior row and nothing else. The second run recomputes the same spans and
  // writes the same numbers, so it is waste rather than convergence.
  //
  // A row this pass did not write stays tracked, because then its window is an
  // independent input: a level that held places nothing, and the level beyond it
  // has to keep waking on the row's own motion. The hand-nudge case is not lost
  // either — re-asserting the follow over a row the user dragged belongs to the
  // exact pass, which reads `coarseDynamicBlocks` for exactly that reason.
  addDisposer(
    self,
    autorun(
      function syntenyFollowFrameAutorun() {
        if (!self.followSynteny) {
          return
        }
        const written = new Set<LinearGenomeViewModel>()
        const placed: PlacedWindows = new Map()
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          // The carry subsumes `written` for the row it covers: a row this pass
          // placed across several contigs is not read at all, so there is no
          // read to take untracked.
          const carried = placed.get(stayingView)
          const windows =
            carried ??
            followAnchorWindows(
              written.has(stayingView)
                ? // eslint-disable-next-line no-restricted-syntax -- self-write: this pass wrote that row
                  untracked(() => stayingView.dynamicBlocks.contentBlocks)
                : stayingView.dynamicBlocks.contentBlocks,
            )
          // The multi-contig rung's ANSWER is recomputed here rather than
          // steered by the settle — it chooses no block, so there is nothing
          // cached to steer by. Whether to take the rung at all is the settle's
          // to decide: the two placements are the furthest apart this subsystem
          // can put a row, and a per-frame re-decision flips between them across
          // a threshold the user is panning along.
          const spread =
            windows.length > 1 ? levelStates.spreadFor(level) : undefined
          if (windows.length > 1 && spread?.spreading !== false) {
            const { spans } = followSpreadSpans({
              displays: level.linearSyntenyDisplays,
              windows,
              toMate,
              mateAssembly,
            })
            if (spans.length) {
              placed.set(movingView, followPlacedWindows(spans))
              positionViewOnSpans(movingView, spans)
            }
            continue
          }
          // The demoted level's kept contig, and the WIDEST WINDOW when the
          // anchor has since scrolled off it. A refusal names a contig out of
          // the window set it was measured over, and the settle that would
          // re-measure is half a second away — so a pan that carries the kept
          // contig off screen left the row frozen for the rest of the drag,
          // where the same fall-through the settle takes places it from the
          // window the reader is now mostly looking at. The DECISION is still
          // the settle's; this is only which window carries it out.
          const window =
            windows.find(w => w.refName === spread?.onto) ?? windows[0]
          // the block the last settle chose, rather than re-picking one per
          // frame. Its direction has to match, since it was picked on whichever
          // axis `toMate` was then, and its display has to be alive, since
          // hiding a synteny track destroys it and reading featureData throws.
          const pick = levelStates.pickFor(level)
          if (
            !window ||
            !pick ||
            pick.toMate !== toMate ||
            !isAlive(pick.display)
          ) {
            continue
          }
          const data = pick.display.featureData
          if (!data) {
            continue
          }
          const span = followFrameSpan({
            feat: pick.feat,
            data,
            window,
            toMate,
            mateAssembly,
            transform: pick.transform,
            map: levelStates.mapFor(level, pick.feat.id),
            incumbentTarget: pick.target,
          })
          if (span && positionViewOnSpan(movingView, span)) {
            written.add(movingView)
          }
        }
      },
      { name: 'SyntenyFollowFrame' },
    ),
  )
}

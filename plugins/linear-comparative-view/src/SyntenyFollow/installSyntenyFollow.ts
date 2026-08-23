import { getNotificationSink } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { navToResolvedSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { alreadyShowing } from './alreadyShowing.ts'
import {
  followAnchorWindow,
  followAnchorWindows,
  followPlacedWindows,
} from './followAnchorWindow.ts'
import { logFollowSpread, logFollowStep } from './followDebug.ts'
import { followFrameSpan } from './followFrameSpan.ts'
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
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface FollowLevel {
  linearSyntenyDisplays: LinearSyntenyDisplayModel[]
}

export interface FollowPair {
  level: FollowLevel
  stayingView: LinearGenomeViewModel
  movingView: LinearGenomeViewModel
  toMate: boolean
  mateAssembly?: string
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
  followPairs: FollowPair[]
  setFollowUnaligned: (arg: boolean) => void
  setFollowApproximate: (arg: boolean) => void
  setFollowPartial: (arg: FollowPartialReport | undefined) => void
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
      return
    }
    // THE BACKSTOP, and it bounds the loop without claiming to diagnose it.
    // Nothing else damps this: `navToLocString` replaces the row's
    // `displayedRegions` whether or not it moves the row, which invalidates
    // `followPairs` and wakes this pass. Measured on the swapped track — coarse
    // blocks, featureData and width all stable across fourteen consecutive
    // passes — so an `alreadyShowing` that says no while the row has stopped
    // moving is a locked tab, not a misplacement. The two checks above close
    // the two ways that is reachable today; this closes the shape of it.
    //
    // The same target asked for from the same place twice is the one thing that
    // cannot be a real disagreement: the first attempt already had its chance,
    // and the row is still reporting where it was.
    const nav = navSignature(movingWindow, span)
    if (nav === state.lastNav) {
      return
    }
    state.lastNav = nav
    await navToResolvedSpan(movingView, span)
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
  function executeSpread({ level, movingView, spans }: SpreadWork) {
    const state = levelStates.get(level)
    state.pick = undefined
    if (positionViewOnSpans(movingView, spans)) {
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
   * Only where the frame pass would read it: a window wider than the block is
   * placed by the envelope, which several blocks contribute to and no one map
   * describes.
   */
  function ensureCigarMap(state: FollowLevelState, step: FollowStep) {
    const featureId = step.feat.id
    if (
      !step.windowInsideFeat ||
      !step.hasCigar ||
      state.map?.featureId === featureId ||
      state.mapPending === featureId
    ) {
      return
    }
    state.mapPending = featureId
    const generation = levelStates.generation
    requestCigarMap({ model: step.display, feat: step.feat })
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
    state,
    placed,
  }: {
    pair: FollowPair
    windows: FollowWindow[]
    carried: boolean
    state: FollowLevelState
    placed: PlacedWindows
  }) {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const spans = followSpreadSpans({
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
            // UNTRACKED, the one read this rung makes of its moving row: the
            // rung does not otherwise depend on it, and a dependency registered
            // here would wake the pass on the placement it is about to make
            movingRegions: untracked(() => movingView.displayedRegions),
            windows,
            spans,
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
        spread: spans.length ? { level, movingView, spans } : undefined,
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
    if (!widest) {
      // an anchor with no window says nothing about alignment either way
      return { unaligned: false, approximate: false }
    }

    // THE THIRD RUNG. Inside one alignment the answer is a CIGAR walk, wider
    // than one it is the envelope of what lies under the window — and wider
    // than one CONTIG there is no single matching region at all, so the answer
    // is the union across the contigs on screen. Without it a whole-genome
    // overview placed every other row on whichever single contig aligned to the
    // anchor's widest, which is what "show all regions" then only did to the
    // anchor row.
    const spread =
      windows.length > 1
        ? planSpread({ pair, windows, carried: !!carried, state, placed })
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
    // reading the moving row makes it a dependency, which is what re-asserts
    // the follow over a row nudged by hand
    const movingWindow = followAnchorWindow(movingView.coarseDynamicBlocks)
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
                ? untracked(() => stayingView.dynamicBlocks.contentBlocks)
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
            const spans = followSpreadSpans({
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
          const window = spread
            ? windows.find(w => w.refName === spread.onto)
            : windows[0]
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

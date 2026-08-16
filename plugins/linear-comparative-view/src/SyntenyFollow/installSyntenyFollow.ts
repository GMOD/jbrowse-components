import { getSession } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { navToResolvedSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { alreadyShowing } from './alreadyShowing.ts'
import { followAnchorWindow } from './followAnchorWindow.ts'
import { followFrameSpan } from './followFrameSpan.ts'
import { createFollowLevelStates } from './followLevelStates.ts'
import { followTransform } from './followTransform.ts'
import { planFollowStep } from './planFollowStep.ts'
import { positionViewOnSpan } from './positionViewOnSpan.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
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

export interface SyntenyFollowHost extends IStateTreeNode {
  followSynteny: boolean
  followPairs: FollowPair[]
  setFollowUnaligned: (arg: boolean) => void
  setFollowApproximate: (arg: boolean) => void
}

// One level's placement, with the observables the async half needs already read
// off the tree. `movingWindow` is `alreadyShowing`'s operand — where the row
// ACTUALLY is, which the exact pass reads on purpose.
interface FollowWork {
  pair: FollowPair
  step: FollowStep
  movingWindow: FollowWindow | undefined
  // the narrowest window the moving row can show, which is what lets
  // `alreadyShowing` terminate over an answer below it
  movingMinWidthBp: number
  seq: number
  generation: number
}

// One level's share of a settled pass: what to resolve, and what the header
// should say if there is nothing to.
interface FollowPlan {
  // absent when nothing loaded covers the anchor's window
  work?: FollowWork
  unaligned: boolean
  approximate: boolean
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
    pair,
    step,
    movingWindow,
    movingMinWidthBp,
    seq,
    generation,
  }: FollowWork) {
    const { movingView } = pair
    const state = levelStates.get(pair.level)
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
      transform: step.windowInsideFeat
        ? followTransform(step.window, span, step.feat.strand === -1)
        : undefined,
    }
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
      getSession(self).notifyError(message, e)
    }
  }

  // Every observable one level's placement needs, read off the tree HERE:
  // `execute` is async and MobX stops tracking at its first `await`, so a field
  // missing from `FollowStep` can only be read untracked, producing a follow
  // that works once and never re-fires.
  function planLevel(pair: FollowPair): FollowPlan | undefined {
    const { level, stayingView, movingView, toMate, mateAssembly } = pair
    const state = levelStates.get(level)
    // EVERY LEVEL THE PASS VISITS, not only the ones it goes on to resolve. A
    // pass that finds nothing under the window has decided the row holds, and
    // an answer still in flight for the previous window landed and moved it
    // anyway — while the header reported it as holding, which is the one thing
    // that state promises.
    const seq = ++state.seq
    const window = followAnchorWindow(stayingView.coarseDynamicBlocks)
    if (!window) {
      return undefined
    }
    // reading the moving row makes it a dependency, which is what re-asserts
    // the follow over a row nudged by hand
    const movingWindow = followAnchorWindow(movingView.coarseDynamicBlocks)
    const step = planFollowStep({
      displays: level.linearSyntenyDisplays,
      window,
      toMate,
      mateAssembly,
      incumbentId: state.pick?.feat.id,
    })
    return {
      work: step && {
        pair,
        step,
        movingWindow,
        movingMinWidthBp: movingView.minBpPerPx * movingView.width,
        seq,
        generation: levelStates.generation,
      },
      // a level still fetching has no answer YET rather than no answer
      unaligned: !step && level.linearSyntenyDisplays.some(d => d.featureData),
      approximate: !!step && (!step.windowInsideFeat || !step.hasCigar),
    }
  }

  addDisposer(
    self,
    autorun(
      function syntenyFollowAutorun() {
        if (!self.followSynteny) {
          self.setFollowUnaligned(false)
          self.setFollowApproximate(false)
          levelStates.clear()
          return
        }
        const plans = self.followPairs.map(pair => planLevel(pair))
        // written, never read here: reading either would make the autorun a
        // dependency of its own write
        self.setFollowUnaligned(plans.some(p => p?.unaligned))
        self.setFollowApproximate(plans.some(p => p?.approximate))
        // UNTRACKED, because `execute` runs synchronously up to its first
        // `await` and so still inside this reaction. `FollowStep` is meant to
        // be everything it needs, but the resolve reaches the display for
        // `adapterConfig` and `lodTier` — and `lodTier` is derived from both
        // connected views' RAW bpPerPx, which the frame pass writes every
        // frame. That made one settled resolve register the moving row's zoom
        // as a dependency of the debounced pass, costing an extra full plan
        // (the envelope scan included) per settle.
        untracked(() => {
          for (const plan of plans) {
            if (plan?.work) {
              const { work } = plan
              execute(work).catch((e: unknown) => {
                reportError(work.pair.level, e)
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

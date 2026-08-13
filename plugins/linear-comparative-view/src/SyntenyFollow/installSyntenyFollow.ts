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

export interface FollowLevel {
  linearSyntenyDisplays: LinearSyntenyDisplayModel[]
  level: number
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

// Not observable: the autorun writes this every pass, so an observable would
// make it a dependency of the run that writes it and re-enter forever.
interface LevelState {
  featureId?: string
  feat?: FeatPos
  display?: LinearSyntenyDisplayModel
  toMate?: boolean
  // latest-wins: the RPC is not ordered, so a slow earlier resolve can land
  // after a fast later one and park the row at a window already left
  seq: number
  transform?: FollowTransform
  answerKey?: string
  answer?: Promise<ResolvedSpan>
}

// undefined for the envelope, which is a union of every loaded block and so can
// resolve differently for the same window once more of them arrive
function stepKey(step: FollowStep) {
  const { display, feat, toMate, window, windowInsideFeat } = step
  const { refName, start, end } = window
  return windowInsideFeat
    ? `${display.id} ${feat.id} ${toMate} ${refName}:${start}-${end}`
    : undefined
}

// A settle wakes the exact pass three times with the same question, since
// applying an answer flushes the moved row's coarse blocks and refetches it.
// The promise rather than the span so the wakes arriving first share the
// request; each pass still runs its own alreadyShowing against its own window.
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
  // Keyed by the LEVEL NODE, not its index. `reconcileLevels` pops a level when
  // a genome row is removed, and by index the entry outlived it: re-add the row
  // and the fresh level inherited the dead one's incumbent feature and cached
  // transform. A WeakMap is also the whole of the pruning — the destroyed node
  // is the only key that reached the entry.
  let levelStates = new WeakMap<FollowLevel, LevelState>()
  let lastErrorMessage: string | undefined

  function stateFor(level: FollowLevel) {
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
    const state = stateFor(pair.level)
    const seq = ++state.seq
    const span = await answerFor(state, stepKey(step), step)
    // switching the mode off bumps no seq, so it needs its own check
    if (
      seq !== state.seq ||
      !isAlive(self) ||
      !isAlive(movingView) ||
      !self.followSynteny
    ) {
      return
    }
    lastErrorMessage = undefined
    state.featureId = step.feat.id
    state.feat = step.feat
    state.display = step.display
    state.toMate = step.toMate
    // Only from the single-block answer. An envelope is a union several blocks
    // contributed to, so it carries no one strand, and a forward transform
    // cached from one placed the row mirrored inside an inverted alignment
    // until the next settle.
    state.transform = step.windowInsideFeat
      ? followTransform(step.window, span, step.feat.strand === -1)
      : undefined
    if (alreadyShowing(movingWindow, span)) {
      return
    }
    await navToResolvedSpan(movingView, span)
  }

  function reportError(e: unknown) {
    // an RPC outliving its view rejects into here, and getSession throws on a
    // node with no parent
    if (!isAlive(self)) {
      return
    }
    // a follow that cannot resolve cannot resolve repeatedly, and a snackbar
    // per settle would bury the app
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
          self.setFollowUnaligned(false)
          self.setFollowApproximate(false)
          levelStates = new WeakMap()
          lastErrorMessage = undefined
          return
        }
        // every observable read happens in this synchronous pass; `execute` is
        // async and its reads would not be tracked
        const work: [FollowPair, FollowStep, FollowWindow | undefined][] = []
        let unaligned = false
        let approximate = false
        for (const pair of self.followPairs) {
          const { level, stayingView, movingView, toMate, mateAssembly } = pair
          const window = followAnchorWindow(stayingView.coarseDynamicBlocks)
          if (!window) {
            continue
          }
          // reading the moving row makes it a dependency, which is what
          // re-asserts the follow over a row nudged by hand
          const movingWindow = followAnchorWindow(
            movingView.coarseDynamicBlocks,
          )
          const step = planFollowStep({
            displays: level.linearSyntenyDisplays,
            window,
            toMate,
            mateAssembly,
            incumbentId: stateFor(level).featureId,
          })
          if (step) {
            work.push([pair, step, movingWindow])
            if (!step.windowInsideFeat || !step.hasCigar) {
              approximate = true
            }
            // a level still fetching has no answer YET rather than no answer
          } else if (level.linearSyntenyDisplays.some(d => d.featureData)) {
            unaligned = true
          }
        }
        // written, never read here: reading either would make the autorun a
        // dependency of its own write
        self.setFollowUnaligned(unaligned)
        self.setFollowApproximate(approximate)
        for (const [pair, step, movingWindow] of work) {
          execute(pair, step, movingWindow).catch(reportError)
        }
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
          if (!window) {
            continue
          }
          // the block the last settle chose, rather than re-picking one per
          // frame. Its direction has to match, since it was picked on whichever
          // axis `toMate` was then, and its display has to be alive, since
          // hiding a synteny track destroys it and reading featureData throws.
          const cached = levelStates.get(level)
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

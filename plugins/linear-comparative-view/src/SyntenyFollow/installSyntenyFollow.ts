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
}

// One level's resolved intent for this pass, everything observable already read.
interface FollowStep {
  level: number
  display: LinearSyntenyDisplayModel
  movingView: LinearGenomeViewModel
  feat: FeatPos
  window: FollowWindow
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
 * fetch of one LOD tier, and `lastLoc` describes where a panel already is.
 */
interface LevelState {
  // the alignment this level followed last, for pickFollowFeature's hysteresis
  featureId?: string
  // what we last navigated the moving panel to. A follow that resolves to the
  // same place must not call navToLocString again: the call moves the panel,
  // which republishes its coarse blocks, which wakes any level anchored on it —
  // harmless once, but a rounding-level disagreement between two adjacent levels
  // would otherwise ping-pong indefinitely.
  lastLoc?: string
  // latest-wins guard. A pan issues one resolve per settled position and the RPC
  // is not ordered, so a slow earlier one can land after a fast later one and
  // park the panel at a window the user has already left.
  seq: number
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

  function stateFor(level: number) {
    let state = levelStates.get(level)
    if (!state) {
      state = { seq: 0 }
      levelStates.set(level, state)
    }
    return state
  }

  async function execute(step: FollowStep) {
    const { level, display, movingView, feat, window, toMate, hasCigar } = step
    const state = stateFor(level)
    const seq = ++state.seq
    const span = hasCigar
      ? await resolveMatchingSpan({ model: display, feat, window, toMate })
      : interpolateFollowSpan({ feat, window, toMate })
    // superseded while the resolve was in flight, or the view went away
    if (!span || seq !== state.seq || !isAlive(self) || !isAlive(movingView)) {
      return
    }
    const loc = assembleLocStringRaw({
      refName: span.refName,
      start: span.start,
      // at least one base, since a zero-width span assembles into an inverted
      // locstring
      end: Math.max(span.start + 1, span.end),
    })
    if (loc === state.lastLoc) {
      return
    }
    state.lastLoc = loc
    state.featureId = feat.id
    await movingView.navToLocString(loc)
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
              incumbentId: stateFor(level).featureId,
            })
            if (candidate && (!best || candidate.overlap > bestOverlap)) {
              bestOverlap = candidate.overlap
              best = {
                level,
                display,
                movingView,
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
          // aligned sequence again.
          if (best) {
            steps.push(best)
          }
        }
        for (const step of steps) {
          execute(step).catch((e: unknown) => {
            getSession(self).notifyError(`${e}`, e)
          })
        }
      },
      { name: 'SyntenyFollow' },
    ),
  )
}
